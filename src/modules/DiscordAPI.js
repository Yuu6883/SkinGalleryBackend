/** @typedef {{ error: String, access_token: String }} DiscordAuthResponse */

const btoa = require("btoa");
const { discordAppId, discordAppSecret, discordAppRedirect } = require("../../cli/config");
const OAuth2 = "https://discordapp.com/api/oauth2/";

module.exports = class DiscordAPI {

    /** @param {String} token */
    static async verifyCallback(token) {
        let jsonRes = await DiscordAPI.exchange(token);
        console.log(jsonRes);
    }

    /** 
     * @param {String} code 
     * @returns {DiscordAuthResponse}
     */
    static async exchange(code) {
        
        let url = `${OAuth2}token?grant_type=authorization_code&code=${code}&redirect_uri=${discordAppRedirect}`;

        let response = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Basic ${btoa(`${discordAppId}:${discordAppSecret}`)}` },
        });

        return await response.json();
    }
}