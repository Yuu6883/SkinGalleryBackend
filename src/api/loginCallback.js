const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE, hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("LOGIN", req.vanisPermissions)) {
            this.logger.log(req.vanisPermissions, req.vanisUser);
            return void res.sendStatus(403);
        }
            
        const discordAuthorization = await this.discordAPI.exchange(req.query.code, false);
        if (discordAuthorization.error != null) {
            this.logger.warn(`Initial Discord authorization failed: ${discordAuthorization.error} (${discordAuthorization.error_description})`);
            return void res.sendStatus(409);
        }
        const discordInfo = await this.discordAPI.fetchUserInfo(discordAuthorization.access_token);
        if (discordAuthorization.error != null) {
            this.logger.onError(`Initial Discord info fetch failed: ${discordInfo.error} (${discordInfo.error_description})`);
            return void res.sendStatus(502);
        }
        const vanisToken = await this.users.authorize(discordInfo.id, discordAuthorization.access_token, discordAuthorization.refresh_token);

        res.cookie(VANIS_TOKEN_COOKIE, vanisToken, { maxAge: VANIS_TOKEN_AGE });
        res.redirect("/");
    },
    method: "get",
    path: "/login/callback"
};

module.exports = endpoint;
