const { VANIS_TOKEN_COOKIE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        let token = req.cookies[VANIS_TOKEN_COOKIE];
        if (!this.provision.confirmVanisToken(token))
            return void res.sendStatus(403);

        let userDoc = await this.users.findAuthedVanis(token);
        if (!userDoc)
            return void res.sendStatus(403);

        if (await this.discordAPI.revoke(userDoc.discordToken).error) {
            // Discord errored out - not our problem
            this.logger.onError(`Failed to revoke token: ${userDoc.discordToken}`);
            return void res.sendStatus(502);
        }

        if (!await this.users.deauthorizeDiscord(userDoc.discordID)) {
            this.logger.onError(`Failed to deauth: ${userDoc.discordID}`);
            return void res.sendStatus(500);
        }

        // Delete Vanis cookie
        res.cookie(VANIS_TOKEN_COOKIE, "", { maxAge: 0 });
        res.sendStatus(200);
    },
    method: "post",
    path: "/logout"
};

module.exports = endpoint;
