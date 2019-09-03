const { VANIS_TOKEN_COOKIE } = require("../constant");
const DiscordAPI = require("../modules/DiscordAPI");

/** @type {APIEndpointHandler} */
const endpoint = {

    async handler(req, res) {

        let token = req.cookies[VANIS_TOKEN_COOKIE];
        if (!this.provision.confirmVanisToken(token)) 
            return void res.sendStatus(403);
        
        let userDoc = await this.users.findAuthedVanis(token);
        if (!userDoc) 
            return void res.sendStatus(403);

        let revokeRes = await DiscordAPI.revoke(userDoc.discordToken);
        if (revokeRes.error) {
            // Discord yoinked
            this.logger.onError(`Failed to revoke token: ${userDoc.discordToken}`);
            return void res.sendStatus(500);
        }

        let success = await this.users.deauth(userDoc.discordID);
        if (!success) {
            // Not possible
            this.logger.onError(`Failed to deauth: ${userDoc.discordID}`);
            return void res.sendStatus(500);
        }

        // Delete Cookie
        res.cookie(VANIS_TOKEN_COOKIE, "", { maxAge: 0 });
        res.sendStatus(200);
    },
    method: "post",
    path: "/logout"
};

module.exports = endpoint;