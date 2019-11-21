if (process.env.NODE_APP_INSTANCE == undefined) {
    console.error("NSFW process must be started with pm2");
    process.exit(1);
}

const DiscordBot = require("../src/modules/DiscordBot");

let config = require("../cli/config");

const pm2 = require("pm2");

new DiscordBot({}, config).init().then(bot => {

    pm2.connect(err => {
        if (err) throw err;
    
        pm2.launchBus((err, bus) => {
            if (err) throw err;
    
            // Initialize listener for three events
            for (let method of ["pend", "reject", "approve"]) {

                bus.on(method, async packet => {
                    bot.logger.debug(`Received ${method}Skin call`);
                    try {
                        let { discordID, result, skinID, skinName } = packet.data;
                        await bot[`${method}Skin`](discordID, result, skinID, skinName);
                    } catch (e) {
                        bot.logger.onError(`Error while ${method} skin`, e);
                    }
                });
            }

            bus.on("delete", async packet => {
                try {
                    let { skinID, ownerID, skinName, status, newURL } = packet.data;
                    await bot.deleteReview(skinID, ownerID, skinName, status, newURL);
                } catch (e) {
                    bot.logger.onError(`Error while deleting skin`, e);
                }
            });
        });
        
        // Make sure bot online first
        process.send && process.send("ready");
    });
});