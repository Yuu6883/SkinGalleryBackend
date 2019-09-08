const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("UPLOAD_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinName(req.params.skinName))
            return void res.sendStatus(400);

        // TODO: Get the image src that client will send in the body, rate limit, size limit

    },
    method: "post",
    path: "/skins/:skinName"
};

module.exports = endpoint;
