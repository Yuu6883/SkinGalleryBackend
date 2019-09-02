const { VANIS_TOKEN_COOKIE, VANIS_TOKEN_AGE, JWT_SECRET } = require("../constant");
const DiscordAPI = require("../modules/DiscordAPI");
const Jwt = require("jsonwebtoken");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        let token = req.cookies[VANIS_TOKEN_COOKIE];

        if (!this.provision.confirmVanisToken(token)) 
            return void res.sendStatus(403);
        
        let userDoc = await this.users.findAuthedVanis(token);

        if (!userDoc) 
            return void res.sendStatus(403);

        let discordInfo = await DiscordAPI.fetchInfo(userDoc.discordToken);

        // Discord decides to STRIKE
        if (discordInfo.error) {
            let discordResponse = await DiscordAPI.exchange(userDoc.discordRefresh, true);
            discordInfo = await DiscordAPI.fetchInfo(discordResponse.access_token);

            if (discordInfo.error) {
                this.logger.onError("Discord nuked");
                return void res.sendStatus(403);
            }

            let token = await this.users.auth(discordInfo.id, discordResponse.access_token, discordResponse.refresh_token);
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
