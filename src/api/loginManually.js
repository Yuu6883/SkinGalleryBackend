const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    handler(req, res) {
        if (!hasPermission("LOGIN", req.vanisPermissions))
            return void res.sendStatus(403);
        res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${this.config.discordAppID}&scope=identify&response_type=code&redirect_uri=${this.config.discordAppRedirect}`);
    },
    method: "get",
    path: "/login"
};

module.exports = endpoint;
