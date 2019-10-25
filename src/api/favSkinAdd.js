const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!hasPermission("FAV_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinID(req.params.skinID))
            return void res.sendStatus(400);
        
        res.json({ success: 
            await this.users.addFav(req.vanisUser, req.params.skinID)
        });
    },
    method: "put",
    path: "/fav/:skinID"
};

module.exports = endpoint;