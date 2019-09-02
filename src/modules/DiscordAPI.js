/** @typedef {{ error: String, error_description: String, access_token: String, refresh_token: String }} DiscordAuthResponse */
/** @typedef {{ username: String, locale: String, avatar: String, discriminator: String, id: String, error: String }} DiscordUserResponse */

const btoa = require("btoa");
const fetch = require("node-fetch");

const { discordAppId, discordAppSecret, discordAppRedirect } = require("../../cli/config");

const OAuth2 = "https://discordapp.com/api/oauth2/";
const UserEndpoint = "http://discordapp.com/api/v6/users/@me";

module.exports = class DiscordAPI {

    /** 
     * @param {String} code 
     * @param {Boolean} refresh
     * @returns {DiscordAuthResponse}
     */
    static async exchange(code, refresh) {
        
        let type = refresh ? "refresh_token" : "authorization_code";
        let alias = refresh ? "refresh_token" : "code";
        let url = `${OAuth2}token?grant_type=${type}&${alias}=${code}&redirect_uri=${discordAppRedirect}`;

        let response = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Basic ${btoa(`${discordAppId}:${discordAppSecret}`)}` },
        });

        return await response.json();
    }

    /**
     * 
     * @param {String} access_token 
     * @returns {DiscordUserResponse}
     */
    static async fetchInfo(access_token) {
        let discRes = await fetch(UserEndpoint, { headers: { "Authorization" : `Bearer ${access_token}` } });
        return await discRes.json();
    }
}