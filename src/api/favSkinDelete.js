const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("FAV_SKIN", req.permissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinID(req.params.skinID))
            return void res.sendStatus(400);
        
        let success = await this.users.removeFav(req.user, req.params.skinID);
        success && this.skins.restartUpdatePublic();
        
        res.json({ success });
    },
    method: "delete",
    path: "/fav/:skinID",
    closeDuringMaintenance: true
};

module.exports = endpoint;