const { hasPermission } = require("../constant");
const expressForms = require("body-parser");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        
        let skinID = req.params.skinID, name = req.query.name;
        // TODO: make moderator able to edit other people's skin name (might not be neccesary)

        this.logger.inform(`Skin ID: ${skinID} Skin Name: ${name}`);

        if (!this.provision.confirmSkinID(skinID) || !this.provision.confirmSkinName(name))
            return void res.sendStatus(400);

        if (!hasPermission("MODIFY_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!(await this.skins.checkOwnership(req.vanisUser.discordID, skinID)))
            return void res.sendStatus(404);

        res.json({ success: await this.skins.editName(skinID, name) });
    },
    method: "put",
    path: "/skins/:skinID",
};

module.exports = endpoint;
