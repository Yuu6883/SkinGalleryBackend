const { hasPermission, MapToJson } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!this.provision.confirmSkinID(req.params.skinID))
            return void res.sendStatus(400);

        if (!hasPermission("LOGGED_IN", req.vanisPermissions))
            return void res.sendStatus(403);
            
        let skinDoc = await this.skins.findBySkinID(req.params.skinID);
        res.header("Cache-Control", "public,s-maxage=2629746,max-age=1");

        if (!skinDoc)
            return void res.sendStatus(404);
        
        let owner = await this.users.find(skinDoc.ownerID);
        if (!owner || !skinDoc.public) {
            await this.users.removeFav(owner, skinDoc);
            return res.json({ private: true });
        }

        res.json({
            owner: MapToJson(owner.cacheInfo),
            favorites: skinDoc.favorites,
            createdAt: skinDoc.createdAt,
        });  
    },
    method: "get",
    path: "/info/s/:skinID"
};

module.exports = endpoint;