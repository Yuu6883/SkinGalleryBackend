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

        if (skinDoc.ownerID !== req.vanisUser.discordID)
            return void res.sendStatus(404);

        let skinPath = skinDoc.status === "approved" ? SKIN_STATIC : PENDING_SKIN_STATIC;
        skinPath += `/${skinDoc.skinID}.jpg`;

        if (!fs.existsSync(skinPath)) {
            this.logger.warn(`Can't find skin at ${skinPath}`);
        } else fs.unlinkSync(skinPath);

        if (skinDoc.status === "pending" && !(await this.bot.deleteReview(skinDoc.messageID)))
            this.logger.warn("Bot failed to delete review");

        res.json({ success: await this.skins.deleteByID(req.params.skinID) });
        
    },
    method: "delete",
    path: "/skins/:skinID"
};

module.exports = endpoint;