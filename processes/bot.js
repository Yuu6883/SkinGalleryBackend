if (process.env.PM_ID == undefined) {
    console.error("NSFW process must be started with pm2");
    process.exit(1);
}

const DiscordBot = require("../src/modules/DiscordBot");
const { SOCKET_PATH, BOT_SOCKET } = require("../src/constant");
const fs = require("fs");
const ipc = require("node-ipc");

let config = require("../cli/config");
/** @type {DiscordBot} */
let bot;

if (!fs.existsSync(SOCKET_PATH))
    fs.mkdirSync(SOCKET_PATH);
    
ipc.config.id = "BOT";
ipc.config.retry = 2000;
ipc.config.silent = true;

ipc.serve(BOT_SOCKET, () => {
    
    ipc.server.on("connect", () => {
        bot && bot.logger.debug("App connected");
    });

    ipc.server.on("socket.disconnected", () => {
        bot && bot.logger.inform("App disconnected");
    });

    // Initialize listener for three events
    for (let method of ["pend", "reject", "approve"]) {

        ipc.server.on(method, async (data, socket) => {
            if (!bot) return ipc.server.emit(socket, method, 
                { id: ipc.config.id, message: { error: "Discord bot process not ready" }});
    
            bot.logger.debug(`Received ${method}Skin call`);
            
            try {
                let { discordID, result, skinID, skinName } = data.message;
                let message = await bot[`${method}Skin`](discordID, result, skinID, skinName);
                ipc.server.emit(socket, method, { id: ipc.config.id, message });
            } catch (e) {
                bot && bot.logger.onError(`Error while ${method} skin`, e);
                ipc.server.emit(socket, method, { id: ipc.config.id, 
                    message: { error: e.message, stack: e.stack }});
            }
        });
    }

    ipc.server.on("delete", async (data, socket) => {
        if (!bot) return ipc.server.emit(socket, "delete", 
            { id: ipc.config.id, message: { error: "Discord bot process not ready" }});

        try {
            let { messageID, status } = data.message;
            let message = await bot.deleteReview(messageID, status);
            ipc.server.emit(socket, "delete", { id: ipc.config.id, message });
        } catch (e) {
            bot && bot.logger.onError(`Error while deleting skin`, e);
            ipc.server.emit(socket, "delete", { id: ipc.config.id, 
                message: { error: e.message, stack: e.stack }});
        }

    });
});

ipc.server.start();

new DiscordBot({}, config).init().then(b => bot = b);