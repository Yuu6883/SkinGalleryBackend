const fs = require("fs");
const mongoose = require("mongoose");
const Path = require("path");

// Modules
const Logger = require("./modules/Logger");
const Webserver = require("./modules/Webserver");
const DiscordAPI = require("./modules/DiscordAPI");
const Cloudflare = require("./modules/Cloudflare");

// Models
const SkinCollection = require("./models/Skins");
const UserCollection = require("./models/Users");
const Provision = require("./models/Provision");

const { SKIN_STATIC, PENDING_SKIN_STATIC, DELETED_SKIN_STATIC } = require("./constant");

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
        await this.connectToMongoDB();

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

            const pm2 = require("pm2");
            
            await new Promise((resolve, reject) => 
                pm2.connect(err => err ? reject(err) : resolve()));

            /** @type {import("events").EventEmitter} */
            const bus = await new Promise((resolve, reject) =>
                pm2.launchBus((err, bus) => err ? reject(err) : resolve(bus)));
            
            /** @type {{src:string,resolve:()=>void}[]} */
            let nsfwQueue = [];
            let nsfwTimeout;

            const clearNSFW = () => nsfwTimeout && (clearTimeout(nsfwTimeout), 
                nsfwTimeout = null);

            const NSFW_ERROR = { error: "NSFW process timeout" };

            const execNext = async () => {
                if (!nsfwQueue.length) return;
                let task = nsfwQueue.shift();
                task.resolve(await this.nsfwBot.classify(task.src, true));
            }

            const handler = packet => {
                clearNSFW();
                let task = nsfwQueue.shift();
                task && task.resolve(packet.data);
                execNext();
            }

            bus.on("classified", handler);

            // Fake nsfwBot, just a wrapper to call pm2 trigger on the actual process
            this.nsfwBot = {
                /** @param {String} src */
                classify: (src, recursive = false) => new Promise(resolve => {

                    nsfwQueue.push({ src, resolve });

                    if (nsfwQueue.length > 1 && !recursive) return;

                    process.send({
                        type: "classify",
                        data: src
                    });

                    nsfwTimeout = setTimeout(() => {
                        nsfwQueue.shift(); // Get rid of current task
                        clearNSFW();
                        execNext();
                        this.logger.onError(`NSFW process timeout ${nsfwQueue.length}`);

                        resolve(NSFW_ERROR);
                    }, 10000);
                })
            }

            /**
             * @param {"pend"|"approve"|"reject"} method 
             * @param {String} discordID 
             * @param {NSFWPrediction} result 
             * @param {String} skinID 
             * @param {String} skinName 
             * @returns {NSFWPrediction}
             */
            const sendClassifyResult = (method, discordID, 
                result, skinID, skinName) => new Promise(resolve => {
                process.send({
                    type: method,
                    data: { discordID, result, skinID, skinName }
                });
            });

            this.bot = {
                pendSkin:    function() { return sendClassifyResult("pend",    ...arguments)},
                rejectSkin:  function() { return sendClassifyResult("reject",  ...arguments)},
                approveSkin: function() { return sendClassifyResult("approve", ...arguments)},
                deleteReview: (skinID, ownerID, skinName, status, newURL) => {
                    process.send({
                        type: "delete",
                        data: { skinID, ownerID, skinName, status, newURL }
                    });
                },
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
                },
                /** @param {string} skinID */
                moveToPending(skinID) {
                    let sourcePath = Path.join(SKIN_STATIC, `${skinID}.png`);
                    let distPath = Path.join(PENDING_SKIN_STATIC, `${skinID}.png`);

                    if (fs.existsSync(distPath)) return true;
                    if (!fs.existsSync(sourcePath)) {
                        this.logger.onError(`Can NOT find skin at ${sourcePath} while rejecting`);
                        return false;
                    }

                    fs.renameSync(sourcePath, distPath);
                    return true;
                }
            }
        }

        await Promise.all([
            placeholder1,
            placeholder2,
            this.webserver.init(),
            this.skins.startUpdatePublic()]);
    }

    async connectToMongoDB() {
        await mongoose.connect(this.config.dbPath, {
            useCreateIndex: true,
            useNewUrlParser: true,
            useFindAndModify: true,
            useUnifiedTopology: true,
        });
        this.logger.debug("Connected to database");
    }

    async disconnectFromMongoDB() {  
        await mongoose.disconnect();
        this.logger.debug("Disconnected from database");
    }

    async stop() {
        if (this.bot && this.bot.stop)
            await this.bot.stop();

        this.skins.stopUpdatePublic();
        await this.webserver.stop();
        await this.cloudflare.applyPurge();
        await this.disconnectFromMongoDB();
        this.logger.inform("App stopped");
    }
}

module.exports = SkinsApp;
