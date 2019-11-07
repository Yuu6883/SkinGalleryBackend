const btoa = require("btoa");
const fetch = require("node-fetch");

class DiscordAPI {
    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;

        this.oAuth2Url = "https://discordapp.com/api/oauth2/";
        this.userEndpoint = "http://discordapp.com/api/v6/users/@me";
        this.appAuthorization = `Basic ${btoa(`${this.config.discordAppID}:${this.config.discordAppSecret}`)}`;
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    /**
     * @param {String} code
     * @param {Boolean} refresh
     * @returns {DiscordResponse & DiscordAuthorization}
     */
    async exchange(code, refresh) {
        const type = refresh ? "refresh_token" : "authorization_code";
        const codeType = refresh ? "refresh_token" : "code";
        
        let redir = process.platform == "win32" ?
                "http://localhost/api/login/callback" : this.config.discordAppRedirect;

        const url = `${this.oAuth2Url}token?grant_type=${type}&${codeType}=${code}&redirect_uri=${redir}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { Authorization: this.appAuthorization }
        });
        return await response.json();
    }

    /**
     * @param {String} discordAccessToken
     * @returns {DiscordResponse & DiscordUser}
     */
    async fetchUserInfo(discordAccessToken) {
        const response = await fetch(this.userEndpoint, {
            method: "GET",
            headers: { Authorization : `Bearer ${discordAccessToken}` }
        });
        return await response.json();
    }

    /**
     * @param {String} discordAccessToken
     * @returns {DiscordResponse}
     */
    async revoke(discordAccessToken) {
        const response = await fetch(`${this.oAuth2Url}revoke?token=${discordAccessToken}`, {
            method: "POST",
            headers: { Authorization: this.appAuthorization }
        });
        return await response.json();
    }
}

module.exports = DiscordAPI;
