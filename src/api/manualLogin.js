/** @type {APIEndpointHandler} */
const endpoint = {
    handler(req, res) {
        res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${this.config.discordAppId}&scope=identify&response_type=code&redirect_uri=${this.config.discordAppSecret}`);
    },
    method: "get",
    path: "/api/login"
};

module.exports = endpoint;
