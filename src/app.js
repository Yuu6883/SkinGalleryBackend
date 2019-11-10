const fs = require("fs");
const mongoose = require("mongoose");

// Modules
const Logger = require("./modules/Logger");
const Webserver = require("./modules/Webserver");
const DiscordAPI = require("./modules/DiscordAPI");
const Cloudflare = require("./modules/Cloudflare");

// Models
const SkinCollection = require("./models/Skins");
const UserCollection = require("./models/Users");
const Provision = require("./models/Provision");

const { BOT_SOCKET, NSFW_SOCKET, DELETED_SKIN_STATIC } = require("./constant");

class SkinsApp {
    /**
     * @param {AppConfig} config
     */
    constructor(config) {
        this.config = config;

        // Modules
        this.logger = new Logger();
        this.logger._onLog = (_, level, message) => {
            if (level == "ACCESS") return;
            if (this.config.env == "production" && level == "DEBUG") return;
            console.log(`[${level}] ${message}`);
        }

        this.webserver  = new Webserver(this);
        this.discordAPI = new DiscordAPI(this);
        this.cloudflare = new Cloudflare(this);

        // Models
        this.skins = new SkinCollection(this);
        this.users = new UserCollection(this);
        this.provision = new Provision(this);

        /** @type {import("./modules/NSFWbot")} */
        this.nsfwBot = null;
        /** @type {import("./modules/DiscordBot")} */
        this.bot = null;
    }

    async init() {
        this.logger.debug("App init");
        await mongoose.connect(this.config.dbPath, {
            useCreateIndex: true,
            useNewUrlParser: true,
            useFindAndModify: true,
            useUnifiedTopology: true,
        });

        this.logger.debug("Connected to database");

        let placeholder1 = new Promise(() => {});
        let placeholder2 = new Promise(() => {});

        // Not running in pm2, require modules
        if (process.env.NODE_APP_INSTANCE == undefined) {
            const DiscordBot = require("./modules/DiscordBot");
            this.bot = new DiscordBot({}, this.config);
            this.logger = this.bot.logger;
            this.bot.app = this;
            placeholder1 = this.bot.init();

            const NSFWBot = require("./modules/NSFWbot");
            this.nsfwBot = new NSFWBot();
            this.nsfwBot.logger = this.logger;
            placeholder2 = this.nsfwBot.init();

            // Running in pm2
        } else {

            const ipc = require("node-ipc");
            ipc.config.id = `SERVER_${process.env.NODE_APP_INSTANCE||0}`;
            ipc.config.retry = 3 * 1000;
            ipc.config.logDepth = 2;
            ipc.config.sync = true;
            ipc.config.silent = true;

            let botQueue = [];
            /** @type {{src:string,resolve:()=>void}[]} */
            let nsfwQueue = [];

            let botTimeout;
            let nsfwTimeout;

            const clearBot  = () => botTimeout  && (clearTimeout(botTimeout),  
                botTimeout  = null);

            const clearNSFW = () => nsfwTimeout && (clearTimeout(nsfwTimeout), 
                nsfwTimeout = null);

            const NSFW_ERROR = { error: "NSFW process timeout" };

            ipc.connectTo("NSFW", NSFW_SOCKET, () => {

                ipc.of.NSFW.on("connect", () => {
                    this.logger.debug("Connected to NSFW process");
                });

                ipc.of.NSFW.on("disconnect", async () => {
                    clearNSFW();
                    for (let task of nsfwQueue) {
                        task.resolve(NSFW_ERROR);
                    }
                    nsfwQueue = [];

                    if (nsfwQueue.length) {
                        this.logger.inform(`Disconnected from NSFW process\n` + 
                                           `Aborting ${nsfwQueue.length} classify task(s)`);
                    } else {
                        this.logger.debug(`Disconnected from NSFW process`);
                    }
                });
            });

            ipc.connectTo("BOT", BOT_SOCKET, () => {
                ipc.of.BOT.on("connect", () => {
                    this.logger.debug("Connected to BOT process");
                });
                ipc.of.BOT.on("disconnect", () => {
                    this.logger.debug("Disconnected from BOT process");
                });
            });

            // Fake nsfwBot, just a wrapper to call pm2 trigger on the actual process
            this.nsfwBot = {
                /** @param {String} src */
                classify: (src, recursive = false) => new Promise(resolve => {

                    if (!recursive) nsfwQueue.push({ src, resolve });

                    if (nsfwQueue.length > 1 && !recursive) return;

                    ipc.of.NSFW.emit("classify", {
                        id: ipc.config.id,
                        message: src
                    });

                    const execNext = async () => {
                        if (!nsfwQueue.length) return;
                        let task = nsfwQueue.shift();
                        task.resolve(await this.nsfwBot.classify(task.src, true));
                    }

                    const handler = data => {
                        clearNSFW();
                        if (!recursive) nsfwQueue.shift();
                        execNext();
                        resolve(data.message);
                    }

                    ipc.of.NSFW.once("classified", handler);

                    nsfwTimeout = setTimeout(() => {
                        clearNSFW();
                        ipc.of.NSFW.off("classified", handler);
                        execNext();
                        this.logger.onError(`NSFW process timeout ${nsfwQueue.length}`);

                        resolve(NSFW_ERROR);
                    }, 10000);
                })
            }

            /**
             * @param {"pending"|"approve"|"reject"} method 
             * @param {String} discordID 
             * @param {NSFWPrediction} result 
             * @param {String} skinID 
             * @param {String} skinName 
             * @returns {NSFWPrediction}
             */
            const sendClassifyResult = (method, discordID, result, skinID, 
                                        skinName, recursive = false) => new Promise(resolve => {

                if (!recursive) botQueue.push({ method, discordID, result,
                    skinID, skinName, resolve });

                if (botQueue.length > 1 && !recursive) return;

                ipc.of.BOT.emit(method, {
                    id: ipc.config.id,
                    message: { discordID, result, skinID, skinName }
                });

                const execNext = async () => {
                    if (!botQueue.length) return;
                    let task = botQueue.shift();
                    let { method, discordID, result, skinID, skinName } = task;

                    task.resolve(await sendClassifyResult(method, discordID, 
                                result, skinID, skinName, true));
                }

                const handler = data => {
                    clearBot();
                    if (!recursive) botQueue.shift();
                    execNext();
                    resolve(data.message);
                }

                ipc.of.BOT.once(method, handler);

                botTimeout = setTimeout(() => {
                    clearBot();
                    ipc.of.BOT.off(method, handler);
                    execNext();
                    this.logger.onError("BOT process timeout");

                    resolve("NULL");
                }, 10000);

            });

            this.bot = {
                pendSkin:    function() { return sendClassifyResult("pend",    ...arguments)},
                rejectSkin:  function() { return sendClassifyResult("reject",  ...arguments)},
                approveSkin: function() { return sendClassifyResult("approve", ...arguments)},
                deleteReview: (messageID, status, newURL) => new Promise(resolve => {
                    
                    ipc.of.BOT.emit("delete", {
                        id: ipc.config.id,
                        message: { messageID, status, newURL }
                    });

                    let timeout;
                    const handler = data => {
                        resolve(data.message);
                        timeout && clearTimeout(timeout);
                    }

                    ipc.of.BOT.once("delete", handler);

                    timeout = setTimeout(() => {
                        ipc.of.BOT.off("delete", handler);
                        this.logger.onError("BOT process timeout on delete review");

                        resolve(false);
                    }, 10000);
                }),
                /** 
                 * @param {String} path 
                 * @param {SkinStatus} status 
                 */
                moveToTrash: (path, status) => {
                    if (fs.existsSync(path)) {
                        let uid = Provision.generateToken(Provision.letterDigits, 30);
                        fs.renameSync(path, `${DELETED_SKIN_STATIC}/${uid}${status}.png`);
                        return uid;
                    } else {
                        this.logger.warn(`Can NOT find skin at ${path} to move to trash`);
                        return "404";
                    }
                }
            }
        }

        await Promise.all([
            placeholder1,
            placeholder2,
            this.webserver.init(),
            this.skins.startUpdatePublic()]);
    }

    async stop() {
        await this.webserver.stop();
        await this.cloudflare.applyPurge();
        await mongoose.disconnect();
        this.logger.inform("App stopped");
    }
}

module.exports = SkinsApp;
