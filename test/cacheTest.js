const runner = require("./runner");

runner(true).then(async app => {

    let skinDoc = new app.skins.model({
        skinID: "test00",
        ownerID: app.config.admins[0],
        skinName: "test321",
        tags: ["anime", "other"],
        favorites: 123,
        createdAt: Math.round((Date.now() - app.skins.TIME_0) / 1000),
        public: true
    });
    
    console.log("Document before encode: ", skinDoc);
    console.log("All tags", app.config.tags);

    app.skins.publicCache.createCache([skinDoc]);
    console.log("Document after encoded: ", app.skins.publicCache.sortByTime);

    console.log("Document after decoded: ", app.skins.publicCache
        .readCache(app.skins.publicCache.sortByTime)[0]);

    process.exit(0);
});