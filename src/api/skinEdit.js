const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        
        let skinID = req.params.skinID, name = req.query.name;

        name = name || "Unnamed skin";
        name = name.slice(0, 16);

        // TODO: make moderator able to edit other people's skin name (might not be neccesary)

        // this.logger.inform(`Skin ID: ${skinID} Skin Name: ${name}`);

        if (!this.provision.confirmSkinID(skinID) || !this.provision.confirmSkinName(name))
            return void res.sendStatus(400);

        if (!hasPermission("MODIFY_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!(await this.skins.checkOwnership(req.vanisUser.discordID, skinID)))
            return void res.sendStatus(404);

        let success = await this.skins.edit({skinID, name, isPublic: req.query.public == "true" });

        await this.skins.restartUpdatePublic();
        
        res.json({ success });
    },
    method: "put",
    path: "/skins/:skinID",
};

module.exports = endpoint;
