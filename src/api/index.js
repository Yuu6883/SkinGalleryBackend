const { Router } = require("./express");

module.exports = () => {
    const router = new Router();
    require("./auth")(router);
    return router;
};
