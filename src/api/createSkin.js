const { VANIS_TOKEN_COOKIE } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        /** @type {string} */
        let vanisToken = req.cookies[VANIS_TOKEN_COOKIE];

        if (!this.provision.confirmVanisToken(vanisToken))
            return void res.sendStatus(403);

        const userDoc = await this.users.findAuthedVanis(vanisToken);
        if (userDoc == null)
            return void res.sendStatus(403);

        // TODO: Get the image src that client will send in the body, rate limit, size limit
        
    },
    method: "put",
    path: "/skins"
};

module.exports = endpoint;
