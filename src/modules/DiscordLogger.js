const Logger = require("./Logger");
const table = require("./StringTable");
const pm2 = require("pm2");

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
            DEBUG:  true
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

        if (process.env.PM_ID !== undefined) this.initPM2Log();
    }

    initPM2Log() {
        pm2.connect(err => {
            if (err) return this.onError("Failed to connect to pm2", err);
            this.inform("Connected to pm2");

            pm2.launchBus((err, bus) => {
                if (err) return this.onError("Failed to call pm2.launchBus", err);

                bus.on("log:out", packet => {
                    this.print(`[${packet.process.name}:stdout] ${packet.data.replace(/\x1b\[\d+m/g, "").slice(11)}`);
                });

                bus.on("log:err", packet => {
                    this.print(`[${packet.process.name}:stderr] ${packet.data.replace(/\x1b\[\d+m/g, "").slice(11)}`);
                });
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

            let msg = `${logObj.level == "PRINT" ? "" : (dateToString(this.format, logObj.date) + 
                      `[${logObj.level}]  `.slice(0, 8))}${logObj.message + (logObj.level == "PRINT" ? "" : "\n")}`;

            if ((build + msg).length > 2000) {
                this.logs.unshift(logObj);
                break;
            } else {
                build += msg;
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