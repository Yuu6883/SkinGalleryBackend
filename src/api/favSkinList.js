const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!req.user || 
            !hasPermission("FAV_SKIN", req.permissions))
            return void res.sendStatus(403);

        if (req.params.userID == '@me') {
            let skinDocs = await this.skins.findAll(req.user.favorites);

            // Some skin disappeared, might because rejected / deleted, so update user favorites
            if (!req.user.favorites.every(s => skinDocs.some(d => d.skinID == s))) {
                req.user.favorites = skinDocs.map(d => d.skinID);
                await req.user.save();
            }

            return void res.json(skinDocs);
        } else {
            if (!hasPermission("LIST_OTHER_FAV", req.permissions))
                return void res.sendStatus(404);

            let userDoc = await this.users.find(req.params.userID);

            if (!userDoc)
                return void res.sendStatus(404);

            res.json(userDoc.favorites);
        }
    },
    method: "get",
    path: "/fav/:userID"
};

module.exports = endpoint;