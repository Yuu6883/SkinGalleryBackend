const runner = require("./runner");

runner(true).then(async app => {

    let skinDoc = new app.skins.model({
        skinID: "test00",
        ownerID: app.config.admins[0],
        skinName: "test321",
        messageID: "msg123",
        tags: ["agar", "other"],
        favorites: 123,
        createdAt: Math.round((Date.now() - app.skins.TIME_0) / 1000)
    });
    
    console.log("Document before encode: ", skinDoc);
    console.log("All tags", app.config.tags);

    app.skins.publicCache.createCache([skinDoc]);
    console.log("Document after encoded: ", app.skins.publicCache.sortByName);

    console.log("Document after decoded: ", app.skins.publicCache
        .readCache(app.skins.publicCache.sortByName)[0]);

    process.exit(0);
});