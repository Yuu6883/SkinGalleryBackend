if (process.env.NODE_APP_INSTANCE == undefined) {
    console.error("NSFW process must be started with pm2");
    process.exit(1);
}

const fs = require("fs");
const ipc = require("node-ipc");

const NSFWBot = require("../src/modules/NSFWbot");
const { SOCKET_PATH, NSFW_SOCKET } = require("../src/constant");

/** @type {import("../src/modules/NSFWbot")} */
let bot;

if (!fs.existsSync(SOCKET_PATH))
    fs.mkdirSync(SOCKET_PATH);

ipc.config.id = "NSFW";
ipc.config.retry = 2000;
ipc.config.silent = true;

ipc.serve(NSFW_SOCKET, () => {
    
    ipc.server.on("connect", () => {
        bot && bot.logger.debug("App connected");
    });

    ipc.server.on("socket.disconnected", () => {
        bot && bot.logger.debug("App disconnected");
    });

    ipc.server.on("classify", async (data, socket) => {

        if (!bot) return ipc.server.emit(socket, "classified", 
            { id: ipc.config.id, message: { error: "NSFW process not ready" }});

        try {
            bot.logger.debug("Classifying");
            let message = await bot.classify(data.message);
            bot.logger.debug("Classied: ", message);

            ipc.server.emit(socket, "classified", { id: ipc.config.id, message });
        } catch (e) {
            bot && bot.logger.onError("Error while classifying", e);
            ipc.server.emit(socket, "classified", { id: ipc.config.id, message: { error: e.message, stack: e.stack }});
        }
    });
});

ipc.server.start();

new NSFWBot().init().then(b => {
    bot = b;
    process.send && process.send("ready");
});