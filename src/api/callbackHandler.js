const DiscordAPI = require("../modules/DiscordAPI");
const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        let discordResponse = await DiscordAPI.exchange(req.query.code, false);

        if (discordResponse.error) {
            
            this.logger.warn(`Lurker from ${req.ip} yoinking callback: ${discordResponse.error_description}`);
            res.redirect("/?error=yomamagay");

        } else {

            let userInfo = await DiscordAPI.fetchInfo(discordResponse.access_token);
            let token = await this.users.auth(userInfo.id, discordResponse.access_token, discordResponse.refresh_token);

            res.cookie(VANIS_TOKEN_COOKIE, token, { maxAge: VANIS_TOKEN_AGE });
            res.redirect("/");
        }
        
    },
    method: "get",
    path: "/login/callback"
};

module.exports = endpoint;
