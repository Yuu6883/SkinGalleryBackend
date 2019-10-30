const mongoose = require("mongoose");

// Modules
const Bot = require("./modules/DiscordBot");
const Logger = require("./modules/Logger");
const Webserver = require("./modules/Webserver");
const DiscordAPI = require("./modules/DiscordAPI");
const NSFWbot = require("./modules/NSFWbot");
const Cloudflare = require("./modules/Cloudflare");

// Models
const SkinCollection = require("./models/Skins");
const UserCollection = require("./models/Users");
const Provision = require("./models/Provision");

class VanisSkinsApp {
    /**
     * @param {AppConfig} config
     */
    constructor(config) {
        this.config = config;

        // Modules
        this.bot = new Bot(this, { sync: true });
        this.logger = new Logger();
        this.nsfwBot    = new NSFWbot(this);
        this.webserver  = new Webserver(this);
        this.discordAPI = new DiscordAPI(this);
        this.cloudflare = new Cloudflare(this);

        // Models
        this.skins = new SkinCollection(this);
        this.users = new UserCollection(this);
        this.provision = new Provision(this);
    }

    async init() {
        this.logger.inform("App init");
        await mongoose.connect(this.config.dbPath, {
            useNewUrlParser: true,
            useCreateIndex: true,
            useFindAndModify: true
        });

        this.logger.inform("Connected to database");

        await Promise.all(
            this.bot.init(),
            this.nsfwBot.init(),
            this.webserver.init(),
            this.skins.startUpdatePublic());
    }

    async stop() {
        this.logger.inform("App stop");
        await this.webserver.stop();
        await this.cloudflare.applyPurge();
        await this.bot.stop();
        await mongoose.disconnect();
        this.logger.inform("Disconnected from database");
    }
}

module.exports = VanisSkinsApp;
