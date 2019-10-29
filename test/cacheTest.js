const runner = require("./runner");

runner().then(async app => {

    let skinDoc = await app.skins.model.findOne({});
    
    skinDoc.tags = ["agar", "other"];
    console.log(skinDoc);
    console.log(app.config.tags);

    app.skins.publicCache.createCache([skinDoc]);
    console.log(app.skins.publicCache.cache.sortByName
        .slice(32 + 6, 32 + 6 + 8));

    await app.stop();
    process.exit(0);
});