const runner = require("./runner");

runner().then(async app => {
    
    let result = await app.users.dropAll();
    app.logger.inform(`Deleted ${result.deletedCount} users`);

    await app.stop();
});
