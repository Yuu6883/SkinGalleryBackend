const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE, JWT_SECRET } = require("../constant");
const Jwt = require("jsonwebtoken");

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
            discordInfo = await this.discordAPI.fetchInfo(discordResponse.access_token);

            if (discordInfo.error) {
                this.logger.onError(`Discord refused info fetch after refreshing token: ${discordInfo.error}`);
                return void res.sendStatus(502);
            }

            vanisToken = await this.users.authorizeDiscord(discordInfo.id, discordResponse.access_token, discordResponse.refresh_token);
            res.cookie(VANIS_TOKEN_COOKIE, token, { maxAge: VANIS_TOKEN_AGE });
        }

        discordInfo.moderator = userDoc.moderator;
        discordInfo.bannedUntil = userDoc.bannedUntil;

        // Maybe we don't need JWT at all
        res.json(Jwt.sign(discordInfo, JWT_SECRET, { expiresIn: "1h" }));
    },
    method: "post",
    path: "/login"
};

module.exports = endpoint;
