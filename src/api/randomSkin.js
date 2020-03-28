/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        res.json(this.skins.getRandom());
    },
    method: "get",
    path: "/random"
};

module.exports = endpoint;
