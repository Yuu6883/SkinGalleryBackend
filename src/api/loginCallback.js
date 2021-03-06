const { GALLERY_TOKEN_COOKIE, GALLERY_TOKEN_COOKIE_AGE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        // User clicked cancel, probably
        if (!req.query.code)
            return void res.clearCookie(GALLERY_TOKEN_COOKIE).redirect("/");

        const discordAuthorization = await this.discordAPI.exchange(req.query.code, false);
        if (!discordAuthorization || discordAuthorization.error) {
            this.logger.warn(`Initial Discord authorization failed: ${discordAuthorization.error} (${discordAuthorization.error_description}).`);
            return void res.clearCookie(GALLERY_TOKEN_COOKIE).redirect("/");
        }

        const discordInfo = await this.discordAPI.fetchUserInfo(discordAuthorization.access_token);
        if (!discordInfo || discordInfo.error) {
            this.logger.onError(`Initial Discord info fetch failed: ${discordInfo.error} (${discordInfo.error_description})`);
            return void res.clearCookie(GALLERY_TOKEN_COOKIE).redirect("/");
        }

        // this.logger.debug(`Authorizing`, discordAuthorization);
        const userToken = await this.users.authorize(discordInfo.id, discordAuthorization.access_token, discordAuthorization.refresh_token);

        res.cookie(GALLERY_TOKEN_COOKIE, userToken, { maxAge: GALLERY_TOKEN_COOKIE_AGE });
        res.redirect("/");
    },
    method: "get",
    path: "/login/callback"
};

module.exports = endpoint;
