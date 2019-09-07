const mongoose = require("mongoose");
const { EventEmitter } = require("events");

// Modules
const Bot = require("./modules/DiscordBot");
const Logger = require("./modules/Logger");
const Webserver = require("./modules/Webserver");
const DiscordAPI = require("./modules/DiscordAPI");
const Brain = require("./modules/Brain");

// Models
const SkinCollection = require("./models/Skins");
const UserCollection = require("./models/Users");
const Provision = require("./models/Provision");

class VanisSkinsApp extends EventEmitter{
    /**
     * @param {AppConfig} config
     */
    constructor(config) {
        super();
        this.config = config;

        // Modules
        this.bot = new Bot(this);
        this.logger = new Logger();
        this.webserver = new Webserver(this);
        this.discordAPI = new DiscordAPI(this);
        this.brain = new Brain(this); // HUGE BRAIN

        // Models
        this.skins = new SkinCollection(this);
        this.users = new UserCollection(this);
        this.provision = new Provision(this);
    }

    async init() {
        this.logger.inform("App init");
        await mongoose.connect(this.config.dbPath, {
            useNewUrlParser: true,
            useCreateIndex: true
        });
        this.logger.inform("Connected to database");
        await this.bot.init();
        await this.webserver.init();
        this.emit("ready");
    }

    async stop() {
        this.logger.inform("App stop");
        await this.webserver.stop();
        await this.bot.stop();
        await mongoose.disconnect();
        this.logger.inform("Disconnected from database");
    }
}

module.exports = VanisSkinsApp;
