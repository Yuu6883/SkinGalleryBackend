const mongoose = require("mongoose");
const express = require("express");

const API = require("./api/auth");
const Bot = require("./bot");
const Logger = require("./logger");

class VanisSkinsApp {
    /**
     * @param {AppConfig} config
     */
    constructor(config) {
        this.config = config;
        this.logger = new Logger();

        /** @type {import("http").Server} */
        this.webserver = null;

        /** @type {Bot} */
        this.bot = new Bot(this);
    }

    async init() {
        this.logger.inform("init");
        await mongoose.connect(this.config.dbPath, {
            useNewUrlParser: true
        });
        this.logger.inform("connected to database");
        await this.bot.init();
        this.logger.inform("webserver opening @", this.config.httpLocation);
        this.webserver = express()
            .use("/", express.static("../web"))
            .use("/api", API)
            .listen(this.config.httpLocation, () => this.logger.inform("ready"));
    }

    async stop() {
        this.logger.inform("stop");
        this.webserver.close();
        this.logger.inform("webserver closed");
        await this.bot.stop();
        await mongoose.disconnect();
        this.logger.inform("disconnected from database");
    }
}

module.exports = VanisSkinsApp;
