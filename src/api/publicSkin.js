const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("VIEW_PUBLIC_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        res.json(this.skins.getPublicSkins(~~req.query.page));
    },
    method: "GET",
    path:   "/public"
}

module.exports = endpoint;