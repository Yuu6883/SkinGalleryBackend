const nsfwjs = require("nsfwjs");

class Brain {

    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
        console.log(nsfwjs);
    }

}

module.exports = Brain;