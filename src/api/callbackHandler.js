const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        const discordResponse = await this.discordAPI.exchange(req.query.code, false);

        if (!discordResponse.error) {
            // Create the Vanis token
            const userInfo = await this.discordAPI.fetchInfo(discordResponse.access_token);
            const token = await this.users.authorizeDiscord(userInfo.id, discordResponse.access_token, discordResponse.refresh_token);

            res.cookie(VANIS_TOKEN_COOKIE, token, { maxAge: VANIS_TOKEN_AGE });
        } else
            this.logger.warn(`${req.ip} suspicious request at GET /login/callback: ${discordResponse.error_description}`);

        res.redirect("/");
    },
    method: "get",
    path: "/login/callback"
};

module.exports = endpoint;
