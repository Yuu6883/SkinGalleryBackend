const Runner = require("./runner");
const RenderSkins = require("../src/modules/RenderSkin");
const fs = require("fs");

Runner(true).then(async app => {
    await app.connectToMongoDB();

    let owner = app.config.admins[1];

    let userDoc  = await app.users.find(owner);
    let skinDocs = await app.skins.findByOwnerID(owner);

    if (!userDoc) {
        console.error(`Can't find owner user document of ID: ${owner}`);
        process.exit(1);
    }

    if (!skinDocs || !skinDocs.length) {
        console.error("Owner doesn't have any skin documents to list");
        console.error(userDoc.cacheInfo);
        process.exit(1);
    }

    let start = Date.now();
    let buffer = await RenderSkins(userDoc, skinDocs);
    console.log(`Draw time: ${Date.now() - start}ms`);

    fs.writeFileSync(`${__dirname}/dist/RenderSkin.png`, buffer);
    
    await app.disconnectFromMongoDB();
    process.exit(0);
});