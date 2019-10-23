const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE, hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("LOGIN", req.vanisPermissions)) {
            this.logger.inform("no permision", req.vanisUser, req.vanisPermissions);
            return void res.sendStatus(403);
        }

        if (!req.vanisUser) {
            return void res.sendStatus(403);
        }
            
        const discordUserInfo = await this.provision.ensureDiscordAuthorization(req.vanisUser, true);
        if (discordUserInfo == null)
            // Failure at gateway
            return void res.sendStatus(502);

        res.cookie(VANIS_TOKEN_COOKIE, req.vanisUser.vanisToken, { maxAge: VANIS_TOKEN_AGE });
        res.json({
            id: discordUserInfo.id,
            username: discordUserInfo.username,
            discriminator: discordUserInfo.discriminator,
            avatar: discordUserInfo.avatar,
            moderator: req.vanisUser.moderator,
            bannedUntil: req.vanisUser.bannedUntil && req.vanisUser.bannedUntil.getTime()
        });
    },
    method: "post",
    path: "/login"
};

module.exports = endpoint;
