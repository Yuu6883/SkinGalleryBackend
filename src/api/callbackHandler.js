const DiscordAPI = require("../modules/DiscordAPI");

/** @type {APIEndpointHandler} */
const endpoint = {
    handler(req, res) {
        DiscordAPI.verifyCallback(req.query.code);
    },
    method: "post",
    path: "/api/login"
};

module.exports = endpoint;
