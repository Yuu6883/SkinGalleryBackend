const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE, hasPermission } = require("../constant");

const mapToJson = map => [...map.entries()].reduce((prev, curr) => (prev[curr[0]] = curr[1], prev), {});
const jsonToMap = obj => new Map(Object.entries(obj));

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
        let discordUserInfo = mapToJson(req.vanisUser.cacheInfo || new Map());
        
        if (Date.now() - req.vanisUser.cacheTimestamp >
            this.config.userinfoCacheTime || 
            !Object.keys(discordUserInfo).length) {

            discordUserInfo = await this.provision.ensureDiscordAuthorization(
                req.vanisUser, true);

            if (discordUserInfo == null)
                return void res.sendStatus(500);

            req.vanisUser.cacheTimestamp = Date.now();
            req.vanisUser.cacheInfo = jsonToMap(discordUserInfo);

            await req.vanisUser.save();
        }

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
