const runner = require("./runner");
const fs = require("fs");

runner().then(async app => {
    let doc = await app.skins.findBySkinID("gqxyfk");
    await doc.remove();
    await app.stop();
});