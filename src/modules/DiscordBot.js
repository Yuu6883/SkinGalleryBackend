const fs = require("fs");
const { inspect } = require("util");
const mongoose = require("mongoose");
const DiscordJS = require("discord.js");
const { execSync } = require("child_process");

const Table = require("./StringTable");
const Cloudflare = require("./Cloudflare");
const SkinCollection = require("../models/Skins");
const UserCollection = require("../models/Users");
const DiscordLogger = require("./DiscordLogger");
const Provision = require("../models/Provision");
const RenderSkins = require("./RenderSkin");
const VanisLB = require("./VanisLeaderboard");

const { Attachment, RichEmbed, Client } = DiscordJS;
const { SKIN_STATIC, PENDING_SKIN_STATIC, DELETED_SKIN_STATIC } = require("../constant");

class SkinsDiscordBot extends Client {

    /**
     * @param {DiscordJS.ClientOptions} options
     * @param {AppConfig} config
     */
    constructor(options, config) {
        super(options);
        /** @type {import("../app")} */
        this.app = null;
        this.enabled = false;
        this.config = config;
        this.prefix = config.prefix || "!";
        this.logger = new DiscordLogger(this);

        this.cloudflare  = new Cloudflare({ logger: this.logger, config: this.config });
        this.dbusers = new UserCollection({ logger: this.logger, config: this.config, cloudflare: this.cloudflare });
        this.dbskins = new SkinCollection({ logger: this.logger, config: this.config, cloudflare: this.cloudflare });

        this.on("ready", () => {
            /** @type {DiscordJS.TextChannel} */
            this.debugChannel = this.findChannelByID(this.config.debugChannelID);
            this.logger.logChannel = this.debugChannel;
        });

        /** @type {Object<string,number>} */
        this.rependCount = {};
        /** @type {Object<string,DiscordJS.Message>} */
        this.pendingCache = {};
    }

    async init() {

        await mongoose.connect(this.config.dbPath, {
            useCreateIndex: true,
            useNewUrlParser: true,
            useFindAndModify: true,
            useUnifiedTopology: true
        });

        this.logger.debug("Connected to database");

        await this.login(this.config.discordBotToken);
        this.logger.inform(`${this.user.username}#${this.user.discriminator} logged in`);

        /** @type {DiscordJS.TextChannel} */
        this.pendingChannel = this.findChannelByID(this.config.skinPendingChannelID);
        /** @type {DiscordJS.TextChannel} */
        this.approvedChannel = this.findChannelByID(this.config.skinApprovedChannelID);
        /** @type {DiscordJS.TextChannel} */
        this.rejectedChannel = this.findChannelByID(this.config.skinRejectedChannelID);
        /** @type {DiscordJS.TextChannel} */
        this.deletedChannel = this.findChannelByID(this.config.skinDeletedChannelID);
        /** @type {DiscordJS.TextChannel} */
        this.notifChannel = this.findChannelByID(this.config.notifChannelID);

        if (!this.pendingChannel || !this.approvedChannel || !this.rejectedChannel ||
            !this.deletedChannel || !this.notifChannel    || !this.debugChannel) 
            throw Error(`Can NOT find skin channels`);

        await this.updateMods();
        this.startReviewCycle();
        this.pendingChannel.bulkDelete(100, true).catch(console.error);

        this.on("message", message => this.onMessage(message));
        this.on("error",   error   => this.logger.onError(error));

        return this;
    }

    /** @param {DiscordJS.Message} message */
    async onMessage(message) {
        if (this.isAdmin(message.author.id) && message.content.startsWith(this.prefix)) {
            this.runAdminCommand(message);
            this.runModCommand(message);
        } else if (await this.isMod(message.author.id)) {
            this.runModCommand(message);
        } else if (await this.dbusers.isMiniMod(message.author.id)) {
            this.runMiniModCommand(message);
        }
    }

    /** @param {DiscordJS.Message} message */
    async runAdminCommand(message) {
        this.logger.debug("Running ADMIN command: " + message.content);
        
        if (message.content.startsWith(`${this.prefix}delete `)) {
            let skinID = message.content.split(" ")
                .slice(1).join("")
                .replace(this.config.webDomain || "http://localhost", "")
                .replace("/s/", "").replace("/p/", "")
                .replace(".png", "").trim();

            this.delete(skinID, message);
        }

        if (message.content.startsWith(`${this.prefix}mod`)) {

            let arr = message.mentions.users.array();
            for (let i in arr) {

                let user = arr[i];
                let name = `${user.username}#${user.discriminator}`;

                this.logger.inform(`Adding mod for ${name} (${user.id})`);

                if (await this.addMod(user.id)) {
                    await message.channel.send(`**${name}** is now a mod`);
                } else {
                    await message.channel.send(`**${name}** is already a mod`);
                }
            }
        }

        if (message.content.startsWith(`${this.prefix}minimod`)) {

            let arr = message.mentions.users.array();
            for (let i in arr) {

                let user = arr[i];
                let name = `${user.username}#${user.discriminator}`;

                this.logger.inform(`Adding minimod for ${name} (${user.id})`);

                if (await this.dbusers.addMiniMod(user.id)) {
                    await message.channel.send(`**${name}** is now a minimod`);
                } else {
                    await message.channel.send(`**${name}** is already a minimod`);
                }
            }
        }

        if (message.content.startsWith(`${this.prefix}demote`)) {

            let arr = message.mentions.users.array();
            for (let i in arr) {

                let user = arr[i];
                let name = `${user.username}#${user.discriminator}`;

                if (this.isAdmin(user.id)) {
                    return void await message.channel.send(`You tried ${this.config.approveEmoji}`);
                }

                this.logger.inform(`Removing mod for ${name} (${user.id})`);
                if (await this.removeMod(user.id)) {
                    await message.channel.send(`**${user.username}#${user.discriminator}** is demoted to pleb`);
                } else {
                    await message.channel.send(`**${user.username}#${user.discriminator}** is already pleb`);
                }
            }
        }

        if (message.content.startsWith(`${this.prefix}ismod`)) {

            let arr = message.mentions.users.array();
            for (let i in arr) {

                let user = arr[i];
                let name = `${user.username}#${user.discriminator}`;

                let isMod = await this.isMod(user.id);
                let isMiniMod = await this.dbusers.isMiniMod(user.id);
                await message.channel.send(name + " is a " + (isMod ? "**mod**" : (isMiniMod ? "minimod lol" : "pleb")));
            }
        }
        
        if (message.content.startsWith(`${this.prefix}purge `)) {
            let userID = message.content.replace(/\D/g, "").trim();
            this.purge(userID, message);
        }

        if (message.content.startsWith(`${this.prefix}count`)) {
            let result = execSync(`ls ${__dirname}/../../skins | wc -l`).toString();
            message.channel.send(`Total skin count: **${result}**`);
        }

        if (message.content.startsWith(`${this.prefix}size`)) {
            let s_size = execSync(`du -h ${__dirname}/../../skins`).toString().split("\t")[0];
            let p_size = execSync(`du -h ${__dirname}/../../pending_skins`).toString().split("\t")[0];
            let d_size = execSync(`du -h ${__dirname}/../../deleted_skins`).toString().split("\t")[0];
            message.channel.send(`Skin folder size: \`/s:${s_size} /p:${p_size} /d:${d_size} \``);
        }

        if (message.content.startsWith(`${this.prefix}eval `)) {
            this.runEval(message);
        }

        if (message.content == `${this.prefix}approve`) {
            this.approveAll(message);
        }

        if (message.content.startsWith(`${this.prefix}loglevel`)) {
            await this.logger.printLogLevel();
        }

        if (message.content == `${this.prefix}flush`) {
            await this.logger.flush(true);
        }
        
        if (message.content == `${this.prefix}format`) {
            await message.channel.send(`Log format: \`${this.logger.format}\``);
        }

        if (message.content == `${this.prefix}logs`) {
            await message.channel.send(`Log number: \`${this.logger.logs.length}\``);
        }

        if (message.content.startsWith(`${this.prefix}debug `)) {
            if (message.content.split(" ")[1] == "on" ||
                message.content.split(" ")[1] == "true") {
                this.debug(true);
                await message.reply("Debug mode is now **ON**")
            } else {
                this.debug(false);
                await message.reply("Debug mode is now **OFF**")
            }
        }

        if (message.content.startsWith(`${this.prefix}autoflush `)) {
            if (message.content.toLowerCase().split(" ")[1] == "on" ||
                message.content.split(" ")[1] == "true") {
                this.logger.autoflush = true;
                await message.reply("Auto flush is now **ON**")
            } else {
                this.logger.autoflush = false;
                await message.reply("Auto flush is now **OFF**")
            }
        }

        if (message.content == `${this.prefix}update`) {
            await this.updateSite();
            message.channel.send("Site updated");
        }

        if (message.content == `${this.prefix}clean`) {
            await this.pendingChannel.bulkDelete(100);
            message.channel.send("Pending channel cleaned");
        }
    }

    /** @param {DiscordJS.Message} message */
    async runModCommand(message) {
        this.logger.debug("Running MOD command: " + message.content);

        if (message.content == `${this.prefix}exit`) {
            if (!this.config.exitPerm.includes(message.author.id)) return;
            await message.channel.send("Yeet");
            this.logger.inform("Exiting via discord command");
            process.emit("SIGINT");
        }

        if (message.content.startsWith(`${this.prefix}top`)) {
            let top = message.content.split(" ")[1];
            if (message.content.trim() == `${this.prefix}top`) top = 10;
            if (top != ~~top || ~~top <= 0)
                return message.reply(`Invalid option: ${top}`);

            VanisLB(message, top);
        }

        if (message.content.startsWith(`${this.prefix}reject `)) {
            let skinIDs = message.content.split(/ /g)
                .slice(1).map(id => id
                    .replace(this.config.webDomain || "http://localhost", "")
                    .replace("/s/", "").replace("/p/", "")
                    .replace(".png", "").trim());

            skinIDs.forEach(skinID => this.reject(skinID, message));
        }

        if (message.content.startsWith(`${this.prefix}ban `)) {
            let userID = message.content.split(" ").find(token => 
                /^<@\d+>$/.test(token) || /^\d+$/.test(token));
            userID && (userID = userID.replace(/\D/g, ""));
            this.ban(userID, message);
        }

        if (message.content.startsWith(`${this.prefix}unban `)) {
            let userID = message.content.replace(/\D/g, "").trim();
            this.unban(userID, message);
        }

        const limitRegex = /-l (\d+)/g;
        if (message.content.startsWith(`${this.prefix}list `)) {
            let reversed = !!message.content.match(/\b-r\b/);
            let match = /-l ([1-9]\d*)/g.exec(message.content);
            let limit = match ? ~~match[1] : 10;
            let userID = message.content.replace(limitRegex, "")
                .replace(/\b-r\b/, "").replace(/\D/g, "").trim() || message.author.id;
            this.list(userID, message, limit, reversed);
        }

        if (message.content == `${this.prefix}render`) {
            let userID = message.author.id;
            this.render(userID, message);
        }

        if (message.content.startsWith(`${this.prefix}render `)) {
            let userID = message.content.replace(/\D/g, "").trim();
            this.render(userID, message);
        }

        if (message.content.toLowerCase().startsWith(`${this.prefix}ownerof `)) {
            if (message.mentions.users && message.mentions.users.size > 0)
                return await message.reply(`Yuu owns **${message.mentions.users
                    .map(u => u.username).join("** **")}** lol`);

            let skinID = message.content.split(" ")
                .slice(1).join("")
                .replace(this.config.webDomain || "http://localhost", "")
                .replace("/s/", "").replace("/p/", "")
                .replace(".png", "").trim();

            if (!/^\S{6}$/.test(skinID))
                return await message.reply(`Invalid skinID: **${skinID}**`);
            
            this.ownerOf(skinID, message);
        }

        if (message.content == `${this.prefix}rank`) {
            await this.rankMods(message);
        }
    }

    /** @param {DiscordJS.Message} message */
    async runMiniModCommand(message) {
        this.logger.debug("Running MINIMOD command: " + message.content);

        return;
        if (message.content.startsWith(`${this.prefix}report`)) {
            await this.reportSkin(message);
        }
    }

    /** @param {DiscordJS.Message} message */
    async reportSkin(message) {
        const skinIDorURLRegex = /\b(https?:\/\/skins.vanis.io\/s\/)?(?<id>[a-z0-9]{6})\b/g
        let content = message.content;
        let match = skinIDorURLRegex.exec(content);
        let reported = [];

        while (match !== null) {
            let id = match.groups.id;
            let doc = await this.dbskins.findBySkinID(id);
            if (doc && doc.status === "approved") {
                reported.push(id);
                this.pendSkin(doc.ownerID, { description: `Reported by **${message.author.username}#${message.author.discriminator}**` },
                    id, doc.skinName);
            }
            content.replace(skinIDorURLRegex, "");
            match = skinIDorURLRegex.exec(content);
        }
        
        if (reported.length) {
            message.reply(`Skin(s) reported: \`${reported.join(", ")}\``);
        } else {
            message.reply("Include skin ID/URL in your message to report them");
        }
    }

    /** 
     * @param {DiscordJS.Message} message 
     */
    async runEval(message) {
        let code = message.content.replace(`${this.prefix}eval `, "");
        const start = process.hrtime.bigint();
        let channel = message.channel;
        let guild = message.guild;

        try {
            let evaled = eval(code);
            if (evaled instanceof Promise) evaled = await evaled;
            const end = process.hrtime.bigint();
            const type = evaled && typeof evaled === 'object' && evaled.constructor ? evaled.constructor.name : typeof evaled;
            const output = inspect(evaled, {
                depth: 0,
                maxArrayLength: 100
            }).replace(new RegExp(this.config.discordBotToken, "g"), "secret bruh");
    
            message.reply(new RichEmbed()
                .setDescription(`**📥 Input**\n\`\`\`js\n${code}\n\`\`\`\n**📤 Output**\n\`\`\`js\n${output}\n\`\`\`\n**❔ Type:** \`${type}\``)
                .setFooter(`executed in ${Number(end - start) / 1000000} milliseconds`, message.author.displayAvatarURL)
            );
        } catch (error) {
			const end = process.hrtime.bigint();
			error = inspect(error, {
				depth: 0,
				maxArrayLength: 0
            });
            
            message.reply(new RichEmbed()
                .setDescription( `**📥 Input**\n\`\`\`js\n${code}\n\`\`\`\n**❗ Error:**\n\`\`\`\n${error}\n\`\`\``)
                .setFooter(`executed in ${Number(end - start) / 1000000} milliseconds`, message.author.displayAvatarURL)
            );
		}
    }

    /**
     * @param {string} userID 
     * @param {DiscordJS.Message} message 
     */
    async purge(userID, message) {
        let skins = await this.dbskins.findByOwnerID(userID);
        if (skins.length) {
            await message.reply(`Purging skin(s): \`${skins.map(s => s.skinID).join("\`, \`")}\``);
            for (let s of skins) {
                await this.delete(s.skinID, message);
            }
            await this.dbskins.restartUpdatePublic();
        } else {
            await message.reply(`Nothing to purge`);
        }
    }

    /**
     * @param {string} skinID 
     * @param {DiscordJS.Message} message 
     */
    async delete(skinID, message) {
        if (!/^\w{6}$/.test(skinID))
            return await message.reply(`Invalid skin ID: \`${skinID}\``);

        let skinDoc = await this.dbskins.findBySkinID(skinID);

        if (skinDoc === null)
            return message.reply(`Can't find skin ID \`${skinID}\``);

        let skinPath = skinDoc.status === "approved" ? 
                            SKIN_STATIC : PENDING_SKIN_STATIC;
        skinPath += `/${skinDoc.skinID}.png`;

        let uid = this.moveToTrash(skinPath, skinDoc.status);
        uid += skinDoc.status;

        await this.deleteReview(skinDoc.skinID, skinDoc.ownerID, 
            skinDoc.skinName, skinDoc.status, `${this.config.webDomain}/d/${uid}`);
        
        let success = await this.dbskins.deleteByID(skinID);

        if (this.config.env == "production")
            await this.cloudflare.purgeCache(`${this.config.webDomain}/` + 
                `${skinDoc.status == "approved" ? "s" : "p"}/${skinDoc.skinID}`);
        
        await message.channel.send(success ? `Skin \`${skinID}\` deleted` :
            `Failed to delete skin \`${skinID}\``);
    }

    /**
     * @param {string} skinID 
     * @param {DiscordJS.Message} message 
     */
    async reject(skinID, message) {
        if (!/^\w{6}$/.test(skinID))
            return await message.reply(`Invalid skin ID: \`${skinID}\``);

        let skinDoc = await this.dbskins.findBySkinID(skinID);

        if (!skinDoc)
            return message.reply(`Can't find skin ID \`${skinID}\``);

        if (skinDoc.status != "approved")
            return message.reply(`\`${skinID}\`'s status is **${skinDoc.status}**. ` + 
                                 `You can only use \`${this.prefix}reject\` on an approved skin`);
        
        let success = this.moveToPending(skinID);
        
        if (this.config.env == "production")
            await this.cloudflare.purgeCache(`${this.config.webDomain}/s/${skinDoc.skinID}`);

        let embed = new RichEmbed()
            .setTitle(`Skin ${skinDoc.skinName}`)
            .setDescription(`Submitted by <@${skinDoc.ownerID}>`);

        if (this.config.env == "production")
            embed.setURL(`${this.config.webDomain}/p/${skinID}`)
                    .setThumbnail(`${this.config.webDomain}/p/${skinID}`)
                    .setImage("");

        embed.setFooter(`Manually rejected by <@${message.author.id}>`)
            .setTimestamp();

        this.rejectedChannel.send(embed);

        await this.rejectApprovedSkin(skinDoc);

        await message.channel.send(success ? `Skin \`${skinID}\` rejected` :
            `Failed to reject skin \`${skinID}\``);
    }

    /**
     * @param {string} userID 
     * @param {DiscordJS.Message} message 
     */
    async ban(userID, message) {
        if (userID) {
            let banTime = message.content.split(" ").find(token => 
                /^\d+(s|h|d|m|y)$/gi.test(token));

            if (!banTime) {
                return message.reply(`Use ${this.prefix}ban {**UserID**} ` +
                    `{time[**s**|**h**|**d**|**m**|**y**]} to ban someone`);
            }

            const H = 60 * 60 * 1000;
            let unit = {"s":1000,"h":H,"d":24*H,"m":30*24*H,"y":365*24*H}[banTime.slice(-1)];
            let time = ~~banTime.slice(0,-1) * unit;

            if (time <= 0)
                return message.reply("You are retarded.");

            let banned = await this.dbusers.ban(userID, time);

            if (!banned)
                return message.reply(`Can't find user ${userID}`);

            if (await this.isMod(userID)) {
                let u = this.findUserByID(userID);
                await message.reply(`Stop abusing ${u ? u.username : `<@${userID}>`}.`);
            } else {
                await this.purge(userID, message);
            }

            message.reply(`User banned: \`${userID}\` for ${banTime} ${unit==1000?"**TROLLLOLOL**":""}`);
            
        } else {
            return message.reply(`Use ${this.prefix}ban \`/\\D+/\` to ban someone from Vanis Skin`);
        }
    }

    /**
     * @param {string} userID 
     * @param {DiscordJS.Message} message 
     */
    async unban(userID, message) {
        if (userID) {
            let unbanned = await this.dbusers.unban(userID);

            if (!unbanned)
                return message.reply(`Can't find user \`${userID}\``);

            if (await (this.isMod(userID)))
                await message.reply(`Yeet <@${userID}>`);

            message.reply(`User unbanned: \`${userID}\``);
            
        } else {
            return message.reply(`Use ${this.prefix}unban \`/\\D+/\` to unban someone from Vanis Skin`);
        }
    }

    /**
     * @param {string} userID 
     * @param {DiscordJS.Message} message 
     */
    async render(userID, message) {
        message.channel.startTyping();

        let userDoc = await this.dbusers.find(userID);

        if (!userDoc)
            return await message.reply(`Can't find userID **${userID}**`);

        let skins = await this.dbskins.findByOwnerID(userID);

        if (!skins.length)
            return await message.reply(`<@${userID}> doesn't have a skin`);

        try {
            let buffer = await RenderSkins(userDoc, skins);
            await message.reply(new Attachment(buffer, `SPOILER_${Date.now()}.png`));
        } catch (e) {
            this.logger.onError(e);
            await message.reply("Something went wrong while rendering. " +
                                "Flush log to see what happened lol dummy");
        } finally {
            message.channel.stopTyping(true);
        }
    }

    /**
     * @param {string} userID 
     * @param {DiscordJS.Message} message 
     */
    async list(userID, message, limit = 10, reversed = false) {

        if (this.config.env != "production")
            return void message.reply("Use this command in production environment");

        let userDoc = await this.dbusers.find(userID);

        if (!userDoc)
            return await message.reply(`Can't find userID **${userID}**`);

        let skins = await this.dbskins.findByOwnerID(userID);
        let urls = skins.map(doc => `${this.config.webDomain}/` +
            `${doc.status=="approved"?"s":"p"}/${doc.skinID}`);

        if (!skins.length)
            return await message.reply(`<@${userID}> doesn't have a skin`);

        await message.channel.send(`<@${userID}> has **${skins.length}** skins: (showing: **${Math.min(urls.length, limit)}**)`);
        while (urls.length && limit > 0) {
            let url = reversed ? urls.shift() : urls.pop();
            let embed = new RichEmbed()
                .setColor([207, 0, 189])
                .setTitle(url)
                .setThumbnail(url).setURL(url);
            message.channel.send(embed);
            limit--;
        }
    }

    /**
     * @param {DiscordJS.Message} message
     */
    async rankMods(message) {
        let mods = await this.dbusers.getMods();
        let content = "";
        mods.sort((mod1, mod2) => mod2.modScore - mod1.modScore);
        mods.slice(0, 10).forEach((mod, index) => {
            content += `${index + 1}. <@${mod.discordID}>'score: **${mod.modScore}**\n`;
        });
        let embed = new RichEmbed()
            .setTitle("Skin Mod Scoreboard")
            .setAuthor(this.user.username, this.user.avatarURL)
            .setDescription(content)
            .setTimestamp();
        message.channel.send(embed);
    }

    /**
     * @param {string} skinID 
     * @param {DiscordJS.Message} message 
     */
    async ownerOf(skinID, message) {
        let skin = await this.dbskins.findBySkinID(skinID);
        if (!skin) return await message.reply(`Can't find skinID **${skinID}**`);

        let userDoc = await this.dbusers.find(skin.ownerID);
        if (!userDoc) return await message
            .reply(`Can't owner of skinID **${skinID}** **HACKER**`);

        await message.reply(`Owner of \`${skinID}\` is ${userDoc.discordID} (<@${userDoc.discordID}>)`);
    }

    updateSite() {
        return this.cloudflare.purgeCache(
            `${this.config.webDomain}/`,
            `${this.config.webDomain}/assets/js/bundle.js`,
            `${this.config.webDomain}/assets/css/main.css`
        );
    }

    startReviewCycle() {
        if (this.reviewCycle) return false;

        const wrapper = async () => {
            await this.updateReview().catch(e => this.logger.onError(e));
            this.reviewCycle = setTimeout(wrapper, this.config.reviewInterval);
        }
        
        this.reviewCycle = setTimeout(wrapper, 0);

        return true;
    }

    stopReviewCycle() {

        if (!this.reviewCycle) return false;

        clearTimeout(this.reviewCycle);
        this.reviewCycle = null;

        return true;
    }

    /**
     * @param {string} skinID 
     * @param {DiscordJS.Message} message 
     */
    async approveAll(message) {

        if (!this.stopReviewCycle()) {
            await message.reply("Failed to stop review cycle");
            return;
        }

        let pending = await this.dbskins.getPending();

        pending = pending.filter(s => Date.now() - s.createdAt > 10000);

        for (let skinDoc of pending) {
            await this.approvePending(skinDoc);
        }

        if (!this.startReviewCycle()) {
            await message.reply("Failed to restart review cycle");
            process.emit("SIGINT");
        } else {
            if (pending.length)
                await message.reply(`Batch approved ${pending.length} skins`);
            else
                await message.reply(`Can't find skins to batch approve`);
        }
    }

    /** @param {string} id */
    findUserByID(id) {
        return this.users.find(u => u.id == id);
    }

    /** @param {string} id */
    findChannelByID(id) {
        return this.channels.find(c => c.id == id);
    }

    debug(bool) {
        this.logger.config.DEBUG = !!bool;
        if (bool) {
            this.logger.flush();
            this.logger.autoflush = true;
        }
    }

    /**
     * @param {string} ownerID 
     * @param {NSFWPrediction} nsfwResult 
     * @param {string} skinID
     * @param {string} skinName 
     */
    async pendSkin(ownerID, nsfwResult, skinID, skinName) {

        // No color defaults to pink (ERROR)
        nsfwResult.average_color = nsfwResult.average_color || "rgb(207,0,189)";

        let color = nsfwResult.average_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);
        nsfwResult.color = nsfwResult.average_color;
        delete nsfwResult.average_color;

        let embed = new RichEmbed()
            .setColor(color)
            .setTitle(`Skin ${skinID}`)
            .setDescription(`\`${skinName.replace(/`/g, "\\`")}\` submitted by <@${ownerID}>`)
            .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                       `${this.config.rejectThreshold } ${this.config.rejectEmoji } to reject`)
            .setTimestamp();

        if (this.logger.config.DEBUG) {
            embed.description += `\n\`\`\`prolog\n${Table(nsfwResult)}\`\`\``;
        }

        if (nsfwResult.description) embed.description += nsfwResult.description;

        if (this.config.env == "development") {

            if (nsfwResult.data) {
                embed.attachFile(new Attachment(nsfwResult.data, `SPOILER_${skinName}.png`));
            } else {
                embed.attachFile(new Attachment(`${PENDING_SKIN_STATIC}/${skinID}.png`, `SPOILER_${skinName}.png`));
            }

        } else if (this.config.env == "production") {
            let url = `${this.config.webDomain}/p/${skinID}`;
            embed.setImage(url).setURL(url);
        }

        /** @type {DiscordJS.Message} */
        let message = await this.pendingChannel.send(embed);

        await message.react(this.config.approveEmoji);
        await message.react(this.config.rejectEmoji);

        this.pendingCache[skinID] = message;
        return message;
    }

    /**
     * @param {string} ownerID 
     * @param {NSFWPrediction} nsfwResult 
     * @param {string} skinID
     * @param {string} skinName 
     */
    async approveSkin(ownerID, nsfwResult, skinID, skinName) {
        
        // No color defaults to red (ERROR)
        nsfwResult.average_color = nsfwResult.average_color || "rgb(255,0,0)";
        let color = nsfwResult.average_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);
        nsfwResult.color = nsfwResult.average_color;
        delete nsfwResult.average_color;

        let embed = new RichEmbed()
            .setAuthor(this.user.username, this.user.displayAvatarURL)
            .setColor(color)
            .setTitle(`Skin ${skinID} Approved`)
            .setDescription(`\`${skinName.replace(/`/g, "\\`")}\` submitted by <@${ownerID}>`)
            .setFooter(`Automatically approved`)
            .setTimestamp();

        if (this.logger.config.DEBUG) {
            embed.description += `\n\`\`\`prolog\n${Table(nsfwResult)}\`\`\``;
        }

        if (this.config.env === "production") {
            let url = `${this.config.webDomain}/s/${skinID}`;
            embed.setURL(url).setThumbnail(url);
        }
            
        /** @type {DiscordJS.Message} */
        let message = await this.approvedChannel.send(embed);
        return message.id;
    }

    /**
     * @param {string} ownerID 
     * @param {NSFWPrediction} nsfwResult 
     * @param {string} skinID
     * @param {string} skinName 
     */
    async rejectSkin(ownerID, nsfwResult, skinID, skinName) {

        let color = nsfwResult.average_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);

        let embed = new RichEmbed()
            .setAuthor(this.user.username, this.user.displayAvatarURL)
            .setColor(color)
            .setTitle(`Skin ${skinID} Rejected`)
            .setDescription(`\`${skinName.replace(/`/g, "\\`")}\` submitted by <@${ownerID}>`)
            .setFooter(`Automatically rejected`)
            .setTimestamp();
        
        if (this.logger.config.DEBUG) {
            embed.description += `\n\`\`\`prolog\n${Table(nsfwResult)}\`\`\``;
        }

        if (this.config.env == "production") {
            let url = `${this.config.webDomain}/p/${skinID}`;
            embed.setURL(url).setThumbnail(url);
        } else {
            if (nsfwResult.data)
                embed.attachFile(new Attachment(nsfwResult.data, `SPOILER_${skinName}.png`));
            else 
                embed.attachFile(new Attachment(`${DELETED_SKIN_STATIC}/${skinID}.png`, `SPOILER_${skinName}.png`));
        }
            
        /** @type {DiscordJS.Message} */
        let message = await this.rejectedChannel.send(embed);
        return message.id;
    }

    /**
     * @param {SkinDocument} skinDoc
     */
    async rejectApprovedSkin(skinDoc) {
        skinDoc.status = "rejected";
        skinDoc.favorites = 0;
        await skinDoc.save();
    }

    async updateReview() {

        let pendingSkins = await this.dbskins.getPending();
        // this.logger.debug(`Checking ${pendingSkins.length} pending reviews...`);

        let length = pendingSkins.length;
        if (length) {
            await this.user.setActivity(`with ${length} pending skins`, 
                { url: `${this.config.webDomain}`, type: "PLAYING" });

        } else {
            await this.user.setActivity(`for next skin submission`, 
                { url: `${this.config.webDomain}`, type: "WATCHING" });
        }

        pendingSkins = pendingSkins.slice(-25);

        for (let skinDoc of pendingSkins) {

            let message = this.pendingCache[skinDoc.skinID];

            // Db might update before the message is sent, so wait a bit to repend
            if (!message) {
                this.rependCount[skinDoc.skinID] = (this.rependCount[skinDoc.skinID] + 1) || 1;

                if (this.rependCount[skinDoc.skinID] >= 3) {
                    message = await this.pendSkin(skinDoc.ownerID,
                        { error: "Recovered" }, skinDoc.skinID, skinDoc.skinName);
                } else continue;
            }

            let approvedReactions = message.reactions.get(this.config.approveEmoji);
            let rejectReactions   = message.reactions.get(this.config.rejectEmoji);

            let approveCount = await this.filterModReaction(approvedReactions);
            let rejectCount  = await this.filterModReaction(rejectReactions);

            if (approveCount >= this.config.approveThreshold) {

                await this.approvePending(skinDoc, approvedReactions).catch(console.error);

            } else if (rejectCount >= this.config.rejectThreshold) {

                await this.rejectPending(skinDoc, rejectReactions).catch(console.error);

            } else continue;

            delete this.pendingCache[skinDoc];
            await message.delete().catch(console.error);
        }
    }

    /**
     * @param {SkinDocument} skinDoc 
     * @param {DiscordJS.MessageReaction} approvedReactions
     */
    async approvePending(skinDoc, approvedReactions) {

        skinDoc.status = "approved";
        skinDoc.createdAt = 0;
        await skinDoc.save();

        let success = this.moveToApprove(skinDoc.skinID);

        if (success) {

            let users = approvedReactions.users.filter(u => u !== this.user);
            let extra = approvedReactions ? `This skin was approved by: \n**` + 
                                                users.map(u => `<@${u.id}>`).join(" ") + "**\n" :
                                            `Batch approved`;

            users.forEach(user => this.dbusers.increModScore(user.id));

            let embed = new RichEmbed()
                .setTitle(`Skin ${skinDoc.skinID} Approved`)
                .setDescription(`\`${skinDoc.skinName.replace(/`/g,"\\`")}\` submitted by <@${skinDoc.ownerID}> ${extra}`)
                .setTimestamp();

            if (this.config.env === "production") {
                let url = `${this.config.webDomain}/s/${skinDoc.skinID}`;
                embed.setThumbnail(url).setURL(url);
            } else {
                // dev
                embed.attachFile(new Attachment(`${SKIN_STATIC}/${skinDoc.skinID}.png`, skinDoc.skinName + ".png"));
            }

            await this.approvedChannel.send(embed);

            let user = this.findUserByID(skinDoc.ownerID);

            if (user) {

                let skinEmbed = new RichEmbed()
                    .setTitle("Your skin was approved!")
                    .setColor("GREEN")
                    .setFooter("Thanks for using this app")
                    .setTimestamp();

                if (this.config.env === "production") {

                    let url = `${this.config.webDomain}/s/${skinDoc.skinID}`;
                    skinEmbed
                        .setThumbnail(url)
                        .setURL(url)
                        .setDescription(`Skin URL: **\`${this.config.webDomain}/s/${skinDoc.skinID}\`**`);
                    
                } else {
                    // dev
                    skinEmbed.attachFile(new Attachment(`${SKIN_STATIC}/${skinDoc.skinID}.png`, skinDoc.skinName + ".png"));
                }

                try {
                    let dm = await user.createDM();
                    await dm.send(skinEmbed);
                } catch(_) {
                    if (!skinDoc.public) {
                        skinEmbed
                            .setDescription("This skin is private, please check out the website.")
                            .setURL(this.config.webDomain)
                            .setThumbnail("");                                
                    }
                    await this.notifChannel.send(`<@${skinDoc.ownerID}>`, skinEmbed).catch(console.error);
                }

            }

        } else await this.pendingChannel.send(`Error: can't find skin ${skinDoc.skinName}(${skinDoc.skinID})`);
    }

    /**
     * @param {SkinDocument} skinDoc 
     * @param {DiscordJS.MessageReaction} rejectReactions
     */
    async rejectPending(skinDoc, rejectReactions) {
        skinDoc.status = "rejected";
        await skinDoc.save();
        let users = rejectReactions.users.filter(u => u !== this.user);
        let extra = rejectReactions ? `This skin was rejected by: \n**` + 
                                        users.map(u => `<@${u.id}>`).join(" ") + "**\n" :
                                      "";

        users.forEach(user => this.dbusers.increModScore(user.id));

        if (!extra) {
            this.logger.warn(`Skin must be rejected with reactions`);
        }

        let embed = new RichEmbed()
                .setTitle(`Skin ${skinDoc.skinID} Rejected`)
                .setColor("RED")
                .setDescription(`\`${skinDoc.skinName.replace(/`/g, "\\`")}\` submitted by <@${skinDoc.ownerID}> ${extra}`)
                .setTimestamp();

        if (this.config.env == "production") {
            let url = `${this.config.webDomain}/p/${skinDoc.skinID}`;
            embed.setURL(url).setImage(url);
        } else {
            embed.attachFile(new Attachment(`${PENDING_SKIN_STATIC}/${skinDoc.skinID}.png`, 
                                            "SPOILER_" + skinDoc.skinName + ".png"));
        }

        /** @type {DiscordJS.Message} */
        let message = await this.rejectedChannel.send(embed);

        let user = this.findUserByID(skinDoc.ownerID);

        if (user) {

            let skinEmbed = new RichEmbed()
                .setTitle("Your skin was rejected!")
                .setColor("RED")
                .setDescription(`You may ask moderators why this skin was rejected.`)
                .setTimestamp();

            if (this.config.env == "production")
                skinEmbed.setImage(message.embeds[0].image.proxyURL);
            try {
                let dm = await user.createDM();
                await dm.send(skinEmbed);
            } catch(_) {
                skinEmbed.setImage("");
                await this.notifChannel.send(`<@${skinDoc.ownerID}>`, skinEmbed).catch(this.logger.onError);
            }
        }
    }

    /** 
     * @param {String} skinID
     * @param {String} ownerID
     * @param {String} skinName
     * @param {SkinStatus} status
     * @param {string} newURL
     */
    async deleteReview(skinID, ownerID, skinName, status, newURL) {
        
        if (status !== "pending" || !this.pendingCache[skinID]) {
            let embed = new RichEmbed()
                .setTitle(`Skin ${skinName} deleted`)
                .setDescription(`Submitted by <@${ownerID}>\nStatus: **${status}**`)
                .setURL(newURL).setThumbnail(newURL)
                .setTimestamp();

            await this.deletedChannel.send(embed);
            return;
        }
        
        let message = this.pendingCache[skinID];
        delete this.pendingCache[skinID];
        let embed = this.copyEmbed(message.embeds[0]);

        if (newURL) {
            embed.setThumbnail(newURL);
            embed.setImage("");
        }

        embed.title = embed.title.replace(new RegExp(status, "i"), "Deleted");

        if (!embed.title.includes("Deleted")) embed.title += " Deleted";

        await this.deletedChannel.send(embed);

        message && message.deletable && (await message.delete());
        return true;
    }

    /** @param {DiscordJS.MessageEmbed} embed */
    copyEmbed(embed) {

        let copy = new RichEmbed();

        if (embed) {
            embed.author && (copy.setAuthor(embed.author.name, embed.author.iconURL))
            embed.color  && (copy.setColor(embed.color));
            embed.title  && (copy.setTitle(embed.title));
            embed.description && (copy.setDescription(embed.description));
            embed.thumbnail   && (copy.setThumbnail(embed.thumbnail.url));
            embed.footer && (copy.setFooter(embed.footer.text));
            embed.image  && (copy.setImage(embed.image.url));
        }

        copy.setTimestamp();

        return copy;
    }

    /** @param {string} skinID */
    moveToApprove(skinID) {
        let sourcePath = `${PENDING_SKIN_STATIC}/${skinID}.png`;
        let distPath = `${SKIN_STATIC}/${skinID}.png`;

        if (!fs.existsSync(sourcePath)) {
            this.logger.onError(`Can NOT find skin at ${sourcePath} while approving`);
            return false;
        }

        fs.renameSync(sourcePath, distPath);
        return true;
    }

    /** @param {string} skinID */
    moveToPending(skinID) {
        let sourcePath = `${SKIN_STATIC}/${skinID}.png`;
        let distPath   = `${PENDING_SKIN_STATIC}/${skinID}.png`;

        if (!fs.existsSync(sourcePath)) {
            this.logger.onError(`Can NOT find skin at ${sourcePath} while rejecting`);
            return false;
        }

        fs.renameSync(sourcePath, distPath);
        return true;
    }

    /** 
     * @param {string} path 
     * @param {SkinStatus} status
     */
    moveToTrash(path, status) {
        if (fs.existsSync(path)) {
            let uid = Provision.generateToken(Provision.letterDigits, 30);
            fs.renameSync(path, `${DELETED_SKIN_STATIC}/${uid}${status}.png`);
            return uid;
        } else {
            this.logger.warn(`Can NOT find skin at ${path} to move to trash`);
            return "404";
        }
    }

    /** @param {DiscordJS.MessageReaction} reaction */
    async filterModReaction(reaction) {

        let userArray = reaction.users.array();
        let count = 0;
        for (let i in userArray) {
            let user = userArray[i];
            // let name = `${user.username}#${user.discriminator}`;

            if (!(await this.isMod(user.id))) {
                // this.logger.inform(`${name} not a mod, removing emoji`);
                await reaction.remove(user);
            } else if (this.isAdmin(user.id)) count += 2
            else count++;
        }

        return count;
    }

    async updateMods() {
        this.modsCache = (await this.dbusers.getMods()).map(d => d.discordID);
        this.modsCacheTimestamp = Date.now();
        // console.log("MODS: ", this.modsCache);
        return false;
    }

    /** @param {string} discordID */
    isAdmin(discordID) { return this.config.admins.includes(discordID) }

    /** @param {string} discordID */
    async addMod(discordID) {
        let r = await this.dbusers.addMod(discordID);
        await this.updateMods();
        return r;
    }

    /** @param {string} discordID */
    async removeMod(discordID) {
        let r = await this.dbusers.removeMod(discordID);
        await this.updateMods();
        return r;
    }

    /** 
     * @param {string} discordID 
     * @returns {boolean}
     */
    async isMod(discordID) {
        if (discordID === this.user.id) return true;
        if (this.config.admins.includes(discordID)) return true;
        if (Date.now() - this.modsCacheTimestamp < 5000) return this.modsCache.includes(discordID);
        else {
            await this.updateMods();
            return this.isMod(discordID);
        }
    }

    async stop() {
        this.stopReviewCycle();
        this.logger.inform("Discord bot logging out");
        await this.logger.flush();
        await this.destroy();
    }
}

module.exports = SkinsDiscordBot;
