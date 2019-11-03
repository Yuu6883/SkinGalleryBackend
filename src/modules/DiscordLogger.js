const Logger = require("./Logger");
const table = require("./StringTable");

/**
 * @param {String} format
 * @param {Date} date
 */
const dateToString = (format, date) => {
    const dy = date.getFullYear();
    const dm = ("00" + (date.getMonth() + 1)).slice(-2);
    const dd = ("00" + (date.getDate())).slice(-2);
    const th = ("00" + (date.getHours())).slice(-2);
    const tm = ("00" + (date.getMinutes())).slice(-2);
    const ts = ("00" + (date.getSeconds())).slice(-2);
    const tz = ("000" + (date.getMilliseconds())).slice(-3);
    return format
        .replace("%Y", dy)
        .replace("%M", dm)
        .replace("%D", dd)
        .replace("%h", th)
        .replace("%m", tm)
        .replace("%s", ts)
        .replace("%z", tz);
}

class DiscordLogger extends Logger {

    /** 
     * @param {import("./DiscordBot")} bot
     * @param {import("discord.js").TextChannel} logChannel
     */
    constructor(bot, logChannel) {

        super();
        this.bot = bot;
        this.logChannel = logChannel;

        /** @type {{date:Date,level:LogEventLevel,message:String}[]} */
        this.logs = [];
        this.format = "%h:%m:%s.%z";
        
        this.config = {
            FILE:   true,
            TEST:   true,
            INFO:   true,
            WARN:   true,
            PRINT:  true,
            ERROR:  true,
            FATAL:  true,
            DEBUG:  false
        }

        /** @type {LogEvent} */
        this._onLog = (date, level, message) => {
            this.logs.push({ date, level, message });
        }

        process.on("SIGINT", async () => {
            this.inform("Process received SIGINT");
            await this.flush();
            await this.bot.stop();
            process.exit(0);
        });

        if (process.env.NODE_APP_INSTANCE !== undefined) {
            this.pm2 = require("pm2");
            this.initPM2Log();
        }
    }

    async initPM2Log() {
        await new Promise(resolve => this.pm2.connect(err => {
            if (err) return this.onError("Failed to connect to pm2", err);
            resolve();
        }));

        this.pm2.launchBus((err, bus) => {
            if (err) return this.onError("Failed to call pm2.launchBus", err);

            bus.on("log:out", packet => {
                this.print(`$${packet.process.pm_id}[${packet.process.name}:out] ${packet.data
                            .replace(/\x1b\[\d+m/g, "")
                            .replace(/^\d{4}\-\d{2}\-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/)}`, "");
            });

            bus.on("log:err", packet => {
                this.print(`$${packet.process.pm_id}[${packet.process.name}:err] ${packet.data
                            .replace(/\x1b\[\d+m/g, "")
                            .replace(/^\d{4}\-\d{2}\-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/)}`, "");
            });
        });
    }

    /** @param {string} msg */
    send(msg) {
        if (!this.logChannel) return;
        return this.logChannel.send(msg).catch(console.error);
    }
    
    async flush() {

        let build = "";

        while (this.logs.length) {

            let logObj = this.logs.shift();

            if (!this.config[logObj.level]) continue;

            let msg = `${logObj.level == "PRINT" ? "" : 
                       process.env.NODE_APP_INSTANCE ? `$${process.env.NODE_APP_INSTANCE}[${process.env.name}:out] ` : "" + 
                      `[${logObj.level}]`.padEnd(7, " ")}${logObj.message + (logObj.level == "PRINT" ? "" : "\n")}`;

            if ((build + msg.trim()).length > 2000) {
                this.logs.unshift(logObj);
                break;
            } else {
                build += msg.trim() + "\n";
            }
        }

        if (build)
            await this.send(`\`\`\`prolog\n${build}\`\`\``);
        else
            await this.send("No new logs available");
    }

    async printLogLevel() {
        await this.send(`\`\`\`prolog\n${table(config)}\`\`\``);
    }
}

module.exports = DiscordLogger;