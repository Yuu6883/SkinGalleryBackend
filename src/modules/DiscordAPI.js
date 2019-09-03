/** @typedef {{ error: string, error_description: string, access_token: string, refresh_token: string }} DiscordAuthResponse */
/** @typedef {{ username: string, locale: string, avatar: string, discriminator: string, id: string, error: string }} DiscordUserResponse */
/** @typedef {{ error: string }} DiscordRevokeResponse */

const btoa = require("btoa");
const fetch = require("node-fetch");

class DiscordAPI {
    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;

        this.oAuth2 = "https://discordapp.com/api/oauth2/";
        this.userEndpoint = "http://discordapp.com/api/v6/users/@me";
        this.authorization = `Basic ${btoa(`${this.config.discordAppId}:${this.config.discordAppSecret}`)}`;
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    /**
     * @param {String} code
     * @param {Boolean} refresh
     * @returns {DiscordAuthResponse}
     */
    async exchange(code, refresh) {
        const type = refresh ? "refresh_token" : "authorization_code";
        const alias = refresh ? "refresh_token" : "code";
        const url = `${this.oAuth2}token?grant_type=${type}&${alias}=${code}&redirect_uri=${this.config.discordAppRedirect}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { Authorization: this.authorization }
        });
        return await response.json();
    }

    /**
     * @param {String} discordAccessToken
     * @returns {DiscordUserResponse}
     */
    async fetchInfo(discordAccessToken) {
        const response = await fetch(this.userEndpoint, {
            method: "GET",
            headers: { Authorization : `Bearer ${discordAccessToken}` }
        });
        return await response.json();
    }

    /**
     * @param {String} discordAccessToken
     * @returns {DiscordRevokeResponse}
     */
    async revoke(discordAccessToken) {
        const response = await fetch(`${this.oAuth2}revoke?token=${discordAccessToken}`, {
            method: "POST",
            headers: { Authorization: this.authorization }
        });
        return await response.json();
    }
}

module.exports = DiscordAPI;
