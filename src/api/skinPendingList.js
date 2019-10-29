const { hasPermission, PENDING_SKIN_STATIC } = require("../constant");
const fs = require("fs");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        let skinID = req.params.skinID;

        if (skinID === "404")
            return void res.sendFile(PENDING_SKIN_STATIC + "/404.png");

        if (!this.provision.confirmSkinID(skinID))
            return void res.redirect("/api/p/skin/404");

        if (!hasPermission("LOGGED_IN", req.vanisPermissions) || 
            !hasPermission("LIST_OWNED_SKINS", req.vanisPermissions))
            return void res.sendStatus(403);

        this.logger.debug(req.rawHeaders);

        let pendingSkins = fs.readdirSync(PENDING_SKIN_STATIC).map(n => n.split(".")[0]);

        if (pendingSkins.includes(skinID)) {

            if (!hasPermission("LIST_OTHER_SKINS") && 
                !(await this.skins.checkOwnership(req.vanisUser.discordID, skinID))) {

                return void res.sendStatus(403);
            } else {
                return void res.sendFile(PENDING_SKIN_STATIC + "/" + skinID + ".png");
            }
            
        } else {
            return void res.redirect("/api/p/skin/404");
        }


    },
    method: "use",
    path: "/p/skin/:skinID"
};

module.exports = endpoint;
