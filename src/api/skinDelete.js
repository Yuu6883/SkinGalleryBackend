const { hasPermission, SKIN_STATIC, PENDING_SKIN_STATIC } = require("../constant");
const fs = require("fs");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!this.provision.confirmSkinID(req.params.skinID))
            return void res.sendStatus(400);

        if (!hasPermission("DELETE_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);
            
        let skinDoc = await this.skins.findBySkinID(req.params.skinID);

        if (skinDoc === null)
            return void res.sendStatus(404);

        if (!hasPermission("DELETE_OTHER_SKIN", req.vanisPermissions) &&
            skinDoc.ownerID !== req.vanisUser.discordID)
            return void res.sendStatus(404);

        if (skinDoc.status === "pending") {
            return res.json({ error: "You can't delete a skin until it's approved or rejected" });
        }

        let skinPath = skinDoc.status === "approved" ? SKIN_STATIC : PENDING_SKIN_STATIC;
        skinPath += `/${skinDoc.skinID}.png`;

        let uid = this.bot.moveToTrash(skinPath, skinDoc.status);
        uid += skinDoc.status;

        this.bot.deleteReview(skinDoc.skinID, skinDoc.ownerID, skinDoc.skinName,
             skinDoc.status, `${this.config.webDomain}/d/${uid}`);

        let success = await this.skins.deleteByID(req.params.skinID);
        
        await this.skins.restartUpdatePublic();
        
        if (skinDoc.status == "approved" && this.config.env == "production")
            await this.cloudflare.purgeCache(`${this.config.webDomain}/s/${skinDoc.skinID}`);
        
        res.json({ success });
        
    },
    method: "delete",
    path: "/skins/:skinID",
    closeDuringMaintenance: true
};

module.exports = endpoint;