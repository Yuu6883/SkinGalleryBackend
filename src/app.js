const mongoose = require("mongoose");

// Modules
const Bot = require("./modules/DiscordBot");
const Logger = require("./modules/Logger");
const Webserver = require("./modules/Webserver");

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
        this.bot = new Bot(this);
        this.logger = new Logger();
        this.webserver = new Webserver(this);

        // Models
        this.skins = new SkinCollection(this);
        this.users = new UserCollection(this);
        this.provision = new Provision(this);
    }

    async init() {
        this.logger.inform("init");
        await mongoose.connect(this.config.dbPath, {
            useNewUrlParser: true
        });
        this.logger.inform("connected to database");
        await this.bot.init();
        await this.webserver.init();
    }

    async stop() {
        this.logger.inform("stop");
        await this.webserver.stop();
        await this.bot.stop();
        await mongoose.disconnect();
        this.logger.inform("disconnected from database");
    }
}

module.exports = VanisSkinsApp;
