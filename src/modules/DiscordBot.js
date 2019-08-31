const DiscordJS = require("discord.js");

class VanisSkinsDiscordBot extends DiscordJS.Client {
    /**
     * @param {App} app
     * @param {DiscordJS.ClientOptions} options
     */
    constructor(app, options) {
        super(options);
        this.app = app;

        this.enabled = false;
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    async init() {
        await this.login(this.config.discordBotToken);
        this.logger.inform("Discord bot logged in");
    }
    async stop() {
        await this.destroy();
        this.logger.inform("Discord bot logged out");
    }
}

module.exports = VanisSkinsDiscordBot;

const App = require("../App");
