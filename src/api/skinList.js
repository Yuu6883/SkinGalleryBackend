const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("LOGGED_IN", req.permissions))
            return void res.sendStatus(403);
            
        /** @type {string} */
        let discordID = null;
        if (req.params.userID === "@me")
            discordID = req.user.discordID;
        else if (!this.provision.confirmDiscordID(req.params.userID))
            return void res.sendStatus(400);
        else
            discordID = req.params.userID;

        const self = hasPermission("LOGGED_IN", req.permissions) && discordID == req.user.discordID;
        if (!hasPermission(self ? "LIST_OWNED_SKINS" : "LIST_OTHER_SKINS", req.permissions))
            return void res.sendStatus(403);

        if (await this.users.count(discordID) === 0)
            return void res.sendStatus(404);

        res.json((await this.skins.findByOwnerID(discordID))
                .sort((a, b) => a.skinName.localeCompare(b.skinName)));
    },
    method: "get",
    path: "/skins/:userID"
};

module.exports = endpoint;
