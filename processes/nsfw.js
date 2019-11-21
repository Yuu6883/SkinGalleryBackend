if (process.env.NODE_APP_INSTANCE == undefined) {
    console.error("NSFW process must be started with pm2");
    process.exit(1);
}

const NSFWBot = require("../src/modules/NSFWbot");
const pm2 = require("pm2");

new NSFWBot().init().then(bot => {
    pm2.connect(err => {
        if (err) throw err;
    
        pm2.launchBus((err, bus) => {
            if (err) throw err;

            bus.on("classify", async packet => {

                try {
                    bot.logger.debug("Classifying");
                    let result = await bot.classify(packet.data);
                    bot.logger.debug("Classified: ", result);
        
                    process.send({
                        type: "classified", 
                        data: result 
                    });

                } catch (e) {
                    bot.logger.onError("Error while classifying", e);
                }
            });
        });

        process.send && process.send("ready");
    });
});