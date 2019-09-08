process.once("unhandledRejection", err => { throw err; });

const App = require("../src/app");
/** @type {AppConfig} */
const config = require("../cli/config");

module.exports = async () => {
    const app = new App(config);
    require("../cli/log-handler")(app);
    await app.init();
    return app;
};
