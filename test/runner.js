process.once("unhandledRejection", err => { throw err; });

const App = require("../src/app");
/** @type {AppConfig} */
const config = require("../cli/config");

module.exports = async noInit => {
    const app = new App(config);
    require("../cli/log-handler")(app);
    noInit || await app.init();
    return app;
};
