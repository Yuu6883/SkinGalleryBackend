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

const { BOT_SOCKET, NSFW_SOCKET } = require("./constant");

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
            ipc.config.sync = true;
            ipc.config.silent = true;

            ipc.connectTo("NSFW", NSFW_SOCKET, () => {
                ipc.of.NSFW.on("connect", () => {
                    this.logger.debug("Connected to NSFW process");
                });
                ipc.of.NSFW.on("disconnect", () => {
                    this.logger.debug("Disconnected from NSFW process");
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
                classify: src => new Promise(resolve => {
                    ipc.of.NSFW.emit("classify", {
                        id: ipc.config.id,
                        message: src
                    });

                    ipc.of.NSFW.once("classified", data => 
                        resolve(data.message));
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
            const sendClassifyResult = async (method, discordID, 
                result, skinID, skinName) => new Promise(resolve => {

                ipc.of.BOT.emit(method, {
                    id: ipc.config.id,
                    message: { discordID, result, skinID, skinName }
                });

                ipc.of.BOT.once(method, data => resolve(data.message));
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
                    ipc.of.BOT.once("delete", data => resolve(data.message));    
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
                        this.logger.warn(`Can't find skin at ${path} to move to trash`);
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
