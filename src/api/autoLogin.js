const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        /** @type {string} */
        let vanisToken = req.cookies[VANIS_TOKEN_COOKIE];

        if (!this.provision.confirmVanisToken(vanisToken))
            return void res.sendStatus(403);

        const userDoc = await this.users.findAuthedVanis(vanisToken);
        if (userDoc == null)
            return void res.sendStatus(403);

        const discordInfo = await this.discordAPI.fetchInfo(userDoc.discordToken);
        if (discordInfo.error) {
            // Discord token is invalid - must refresh it
            let discordResponse = await this.discordAPI.exchange(userDoc.discordRefresh, true);

            if (discordResponse.error || !discordResponse.access_token) {
                this.logger.onError(`Discord refused info fetch with refresh token: ${discordResponse.error}`);
                return void res.sendStatus(502);
            }

            discordInfo = await this.discordAPI.fetchInfo(discordResponse.access_token);

            if (discordInfo.error) {
                this.logger.onError(`Discord refused info fetch with refreshed access token: ${discordInfo.error}`);
                return void res.sendStatus(502);
            }

            vanisToken = await this.users.authorizeDiscord(discordInfo.id, discordResponse.access_token, discordResponse.refresh_token);
        }
        
        res.cookie(VANIS_TOKEN_COOKIE, vanisToken, { maxAge: VANIS_TOKEN_AGE });

        discordInfo.moderator = userDoc.moderator;
        discordInfo.bannedUntil = userDoc.bannedUntil;

        res.json(discordInfo);
    },
    method: "post",
    path: "/login"
};

module.exports = endpoint;
