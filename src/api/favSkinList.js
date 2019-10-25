const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {

        if (!req.vanisUser || 
            !hasPermission("FAV_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (req.params.userID == '@me')
            return void res.json(req.vanisUser.favorites);
        else {
            if (!hasPermission("LIST_OTHER_FAV", req.vanisPermissions))
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