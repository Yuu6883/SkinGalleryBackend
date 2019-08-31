process.once("unhandledRejection", err => { throw err; });

const App = require("../src/app");
/** @type {AppConfig} */
const config = require("./config.js");
const app = new App(config);

require("./log-handler")(app);

app.init().then(() => {
    process.once("SIGINT", () => {
        app.logger.inform("SIGINT");
        app.stop();
    });
});
