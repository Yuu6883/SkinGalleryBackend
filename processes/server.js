if (process.env.NODE_APP_INSTANCE == undefined) {
    console.error("NSFW process must be started with pm2");
    process.exit(1);
}

const SkinApp = require("../src/app");
let config = require("../cli/config");

let app = new SkinApp(config)
app.init();

process.on("uncaughtException", e => {
    app.logger.onError(e);
    if (config.env == "development") 
        process.emit("SIGINT");
});

process.on("unhandledRejection", e => {
    app.logger.onError(e);
    if (config.env == "development") 
        process.emit("SIGINT");
});
