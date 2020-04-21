const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("FAV_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinID(req.params.skinID))
            return void res.sendStatus(400);

        if (req.vanisUser.favorites.length >= 200)
            return void res.json({ success: false, error: "You can't star more than 200 skins" });

        let result = await this.users.addFav(req.vanisUser, req.params.skinID);
        result.success && this.skins.restartUpdatePublic();
        res.json(result);
    },
    method: "put",
    path: "/fav/:skinID",
    closeDuringMaintenance: true
};

module.exports = endpoint;