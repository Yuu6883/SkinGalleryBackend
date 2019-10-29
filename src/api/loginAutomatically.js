const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE, hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("LOGIN", req.vanisPermissions)) {
            this.logger.inform("no permision", req.vanisUser, req.vanisPermissions);
            return void res.clearCookie(VANIS_TOKEN_COOKIE).sendStatus(403);
        }

        if (!req.vanisUser)
            return void res.clearCookie(VANIS_TOKEN_COOKIE).sendStatus(403);

        /** @type {DiscordUser} */
        let discordUserInfo;

        if (Date.now() - req.vanisUser.cacheTimestamp >
            this.config.userinfoCacheTime || 
            !Object.keys(req.vanisUser.cacheInfo).length) {

            this.logger.debug(`Ensuring discord auth of ${req.vanisUser.discordID}`);
            discordUserInfo = await this.provision.ensureDiscordAuthorization(
                req.vanisUser, true);

            if (discordUserInfo == null)
                return void res.sendStatus(500);

            req.vanisUser.cacheTimestamp = Date.now();
            req.vanisUser.cacheInfo = discordUserInfo;
            this.logger.debug("Saving info", discordUserInfo);

            await req.vanisUser.save();
        } else discordUserInfo = req.vanisUser.cacheInfo;

        if (!discordUserInfo || !Object.keys(discordUserInfo).length)
            // Failure at gateway
            return void res.sendStatus(500);

        res.cookie(VANIS_TOKEN_COOKIE, req.vanisUser.vanisToken, { maxAge: VANIS_TOKEN_AGE });
        res.json({
            id: discordUserInfo.id,
            username: discordUserInfo.username,
            discriminator: discordUserInfo.discriminator,
            avatar: discordUserInfo.avatar,
            moderator: req.vanisUser.moderator,
            bannedUntil: req.vanisUser.bannedUntil && 
                         req.vanisUser.bannedUntil.getTime()
        });
    },
    method: "post",
    path: "/login"
};

module.exports = endpoint;
