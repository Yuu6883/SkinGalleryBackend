if (process.env.PM_ID == undefined) {
    console.error("NSFW process must be started with pm2");
    process.exit(1);
}

const SkinApp = require("../src/app");
let config = require("../cli/config");

new SkinApp(config).init();