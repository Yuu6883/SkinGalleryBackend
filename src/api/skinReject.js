const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("LOGGED_IN", req.permissions))
            return void res.sendStatus(403);

        if (!hasPermission("REJECT_SKIN", req.permissions))
            return void res.sendStatus(403);

        let skinID = req.params.skinID;
        if (!this.provision.confirmSkinID(skinID))
            return void res.sendStatus(400);

        let skinDoc = await this.skins.findBySkinID(skinID);
        if (!skinDoc)
            return void res.sendStatus(404);

        if (skinDoc.status === "rejected")
            return void res.json({ error: "Skin is already rejected" });
        
        skinDoc.status = "rejected";
        await skinDoc.save();
        let success = this.bot.moveToPending(skinDoc.skinID);
        
        this.bot.rejectSkin(skinDoc.ownerID, { description: 
            `Rejected by <@${req.user.discordID}> through **/reject** endpoint` }, 
            skinID, skinDoc.skinID);

        res.json({ success });
    },
    method: "post",
    path: "/reject/:skinID",
    closeDuringMaintenance: true
};

module.exports = endpoint;
