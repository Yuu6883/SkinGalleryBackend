const { GALLERY_TOKEN_COOKIE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!req.user) {
            return void res.sendStatus(500);
        }

        const deauthorizationResponse = await this.discordAPI.revoke(req.user.discordToken);
        if (deauthorizationResponse.error != null) {
            // Discord errored out - not our problem
            this.logger.onError(`Failed to revoke token '${req.user.discordToken}': ${deauthorizationResponse.error}`);
            return void res.sendStatus(502);
        }

        if (!await this.users.deauthorize(req.user.discordID)) {
            this.logger.onError(`Failed to deauthorize: user with Discord ID '${userDoc.discordID}' not found`);
            return void res.sendStatus(500);
        }

        // Delete cookie
        res.clearCookie(GALLERY_TOKEN_COOKIE);
        res.sendStatus(200);
    },
    method: "post",
    path: "/logout"
};

module.exports = endpoint;
