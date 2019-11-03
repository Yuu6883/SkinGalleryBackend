const runner = require("./runner");

runner().then(async app => {
    app.bot.debug(true);
    await app.cloudflare.purgeCache(
        "http://skins.vanis.io/", "http://skins.vanis.io/assets/js/bundle.js",
        "http://skins.vanis.io/assets/css/main.css",
        "https://skins.vanis.io/", "https://skins.vanis.io/assets/js/bundle.js",
        "https://skins.vanis.io/assets/css/main.css");

    process.emit("SIGINT");
});