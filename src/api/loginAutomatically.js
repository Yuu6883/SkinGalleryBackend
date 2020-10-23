const { GALLERY_TOKEN_COOKIE, GALLERY_TOKEN_COOKIE_AGE, hasPermission,
    MapToJson, JsonToMap } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("LOGIN", req.permissions)) {
            this.logger.inform("no permision", req.user, req.permissions);
            return void res.clearCookie(GALLERY_TOKEN_COOKIE).sendStatus(403);
        }

        if (!req.user)
            return void res.clearCookie(GALLERY_TOKEN_COOKIE).sendStatus(403);

        /** @type {DiscordUser} */
        let discordUserInfo = MapToJson(req.user.cacheInfo || new Map());

        if (Date.now() - req.user.cacheTimestamp > this.config.userinfoCacheTime || !Object.keys(discordUserInfo).length) {
            discordUserInfo = await this.provision.ensureDiscordAuthorization(req.user, true);

            if (discordUserInfo == null)
                return void res.clearCookie(GALLERY_TOKEN_COOKIE).sendStatus(500);

            req.user.cacheTimestamp = Date.now();
            req.user.cacheInfo = JsonToMap(discordUserInfo);

            await req.user.save();
        }

        if (!discordUserInfo || !Object.keys(discordUserInfo).length)
            // Failure at gateway
            return void res.clearCookie(GALLERY_TOKEN_COOKIE).sendStatus(500);

        res.cookie(GALLERY_TOKEN_COOKIE, req.user.userToken, { maxAge: GALLERY_TOKEN_COOKIE_AGE });

        res.json({
            id: discordUserInfo.id,
            username: discordUserInfo.username,
            discriminator: discordUserInfo.discriminator,
            avatar: discordUserInfo.avatar,
            moderator: req.user.moderator,
            favorites: req.user.favorites,
            bannedUntil: req.user.bannedUntil &&
                         req.user.bannedUntil.getTime(),
            bannedReason: req.user.bannedReason,
            limit: req.user.limit
        });
    },
    method: "post",
    path: "/login"
};

module.exports = endpoint;
