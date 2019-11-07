const fs = require("fs");
const { inspect } = require("util");
const mongoose = require("mongoose");
const DiscordJS = require("discord.js");
const { execSync } = require("child_process");

const Cloudflare = require("./Cloudflare");
const SkinCollection = require("../models/Skins");
const UserCollection = require("../models/Users");
const DiscordLogger = require("./DiscordLogger");
const Provision = require("../models/Provision");

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

        this.on("message", message => this.onMessage(message));
        this.on("error",   error   => this.logger.onError(error));

        return this;
    }

    /** @param {DiscordJS.Message} message */
    async onMessage(message) {
        if (this.isAdmin(message.author.id) && message.content.startsWith(this.prefix)) {
            this.runCommand(message);
            this.runModCommand(message);
        } else if (await this.isMod(message.author.id))
            this.runModCommand(message);
    }

    /** @param {DiscordJS.Message} message */
    async runCommand(message) {
        
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

        if (message.content.startsWith(`${this.prefix}demod`)) {

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
                await message.channel.send(name + " is " + (isMod ? "**mod**" : "pleb"));
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
            let result = execSync(`du -h ${__dirname}/../../skins`).toString().split("\t")[0];
            message.channel.send(`Skin folder size: **${result}**`);
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
            await this.logger.flush();
        }
        
        if (message.content == `${this.prefix}format`) {
            await message.channel.send(`Log format: \`${this.logger.format}\``);
        }

        if (message.content == `${this.prefix}logs`) {
            await message.channel.send(`Log number: \`${this.logger.logs.length}\``);
        }
        
        if (message.content == `${this.prefix}exit`) {
            this.logger.inform("Exiting via discord command");
            process.emit("SIGINT");
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

        if (message.content == `${this.prefix}list`) {
            let userID = message.author.id;
            this.list(userID, message);
        }

        if (message.content == `${this.prefix}clean`) {
            await this.pendingChannel.bulkDelete(100);
            message.channel.send("Pending channel cleaned");
        }
    }

    /** @param {DiscordJS.Message} message */
    async runModCommand(message) {

        if (message.content.startsWith(`${this.prefix}delete `)) {
            let skinID = message.content.split(" ")
                .slice(1).join("")
                .replace(this.config.webDomain || "http://localhost", "")
                .replace("/s/", "").replace("/p/", "")
                .replace(".png", "").trim();

            this.delete(skinID, message);
        }

        if (message.content.startsWith(`${this.prefix}reject `)) {
            let skinID = message.content.split(" ")
                .slice(1).join("")
                .replace(this.config.webDomain || "http://localhost", "")
                .replace("/s/", "").replace("/p/", "")
                .replace(".png", "").trim();

            this.reject(skinID, message);
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

        if (message.content.startsWith(`${this.prefix}list `)) {
            let userID = message.content.replace(/\D/g, "").trim();
            this.list(userID, message);
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

        await this.deleteReview(skinDoc.messageID, skinDoc.status, `${this.config.webDomain}/d/${uid}`);
        
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

        if (skinDoc === null)
            return message.reply(`Can't find skin ID \`${skinID}\``);

        if (skinDoc.status != "approved")
            return message.reply(`\`${skinID}\`'s status is **${skinDoc.status}**. ` + 
                                 `You can only use \`${this.prefix}reject\` on an approved skin`);
        
        let success = this.moveToPending(skinID);
        
        if (this.config.env == "production")
            await this.cloudflare.purgeCache(`${this.config.webDomain}/s/${skinDoc.skinID}`);

        let approvedMessage = await this.approvedChannel.fetchMessage(skinDoc.messageID).catch(_ => {});

        if (!approvedMessage) {
            this.logger.warn(`Can't find status message to delete while rejecting skin`);
        } else {
            let embed = this.copyEmbed(approvedMessage.embeds[0]);
            embed.title = embed.title.replace(/approv/i, "reject");
            this.rejectedChannel.send(embed);

            approvedMessage.deletable && approvedMessage.delete();
        }

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
    async list(userID, message) {
        let userDoc = await this.dbusers.find(userID);

        if (!userDoc)
            return await message.reply(`Can't find userID **${userID}**`);

        let skins = await this.dbskins.findByOwnerID(userID);
        let urls = skins.map(doc => `${this.config.webDomain}/` +
            `${doc.status=="approved"?"s":"p"}/${doc.skinID}`);

        if (!skins.length)
            return await message.reply(`<@${userID}> doesn't have a skin`);

        await message.channel.send(`<@${userID}> has **${skins.length}** skins:`);
        while (urls.length) {
            let url = urls.splice(0, 1)[0];
            let embed = new RichEmbed()
                .setTitle(url)
                .setThumbnail(url).setURL(url);
            await message.channel.send(embed);
        }
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

        await message.reply(`Owner of \`${skinID}\` is <@${userDoc.discordID}>`);
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
            await this.updateReview();
            this.reviewCycle = setTimeout(wrapper, this.config.reviewInterval);
        }
        wrapper();

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

            this.getReviewMessage(skinDoc).then(msg => {
                msg && msg.deletable && msg.delete().catch(_ => {});
            });

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

    /** @param {SkinDocument} skinDoc */
    async getReviewMessage(skinDoc) {

        /** @type {DiscordJS.Message} */
        let message;
        
        if (skinDoc.messageID) 
            message = await this.pendingChannel.fetchMessage(skinDoc.messageID).catch(() => {});

        let skinOwner = this.findUserByID(skinDoc.ownerID);

        // Bruh moment (user not in same server with the person)
        if (!skinOwner) {
            // this.logger.onError(`Can't find skin owner of ID ${skinDoc.ownerID}`);
        }

        // Somehow the message is gone by magik
        if (!message) {

            let embed = new RichEmbed()
                .setTitle(`Skin ${skinDoc.skinID} (recovered)`)
                .setDescription(`\`${skinDoc.skinName.replace("`", "\\`")}\` submitted by <@${skinDoc.ownerID}>`) 
                .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                           `${this.config.rejectThreshold } ${this.config.rejectEmoji } to reject`)
                .setTimestamp();

            let url = `${this.config.webDomain}/p/${skinDoc.skinID}`;
            
            embed.setURL(url).setImage(url);

            if (skinOwner) {
                embed.setAuthor(`${skinOwner.username}#${skinOwner.discriminator}` + 
                                `(${skinOwner.id})`, skinOwner.displayAvatarURL)
            } else {
                embed.setAuthor(`User ${skinDoc.ownerID}`);
            }

            message = await this.pendingChannel.send(embed);

            skinDoc.messageID = message.id;
            await skinDoc.save();

            await message.react(this.config.approveEmoji);
            await message.react(this.config.rejectEmoji);
        }

        return message;
    }

    debug(bool) {
        this.logger.config.DEBUG = !!bool;
    }

    /**
     * @param {string} ownerID 
     * @param {NSFWPrediction} nsfwResult 
     * @param {string} skinID
     * @param {string} skinName 
     */
    async pendSkin(ownerID, nsfwResult, skinID, skinName) {

        if (nsfwResult.error)
            return await this.pendingChannel.send(`Error: ${nsfwResult.error}`);

        let color = nsfwResult.avarage_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);
        nsfwResult.color = nsfwResult.avarage_color;
        delete nsfwResult.avarage_color;

        let embed = new RichEmbed()
            .setColor(color)
            .setTitle(`Skin ${skinID}`)
            .setDescription(`\`${skinName.replace(/`/g, "\\`")}\` submitted by <@${ownerID}>`) 
                            // `\n\`\`\`prolog\n${table(nsfwResult)}\`\`\``)
            .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                       `${this.config.rejectThreshold } ${this.config.rejectEmoji } to reject`)
            .setTimestamp();

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

        return message.id;
    }

    /**
     * @param {string} ownerID 
     * @param {NSFWPrediction} nsfwResult 
     * @param {string} skinID
     * @param {string} skinName 
     */
    async approveSkin(ownerID, nsfwResult, skinID, skinName) {

        let color = nsfwResult.avarage_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);

        let embed = new RichEmbed()
            .setAuthor(this.user.username, this.user.displayAvatarURL)
            .setColor(color)
            .setTitle(`Skin ${skinID} Approved`)
            .setDescription(`\`${skinName.replace(/`/g, "\\`")}\` submitted by <@${ownerID}>`)
            .setFooter(`Automatically approved`)
            .setTimestamp();

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

        let color = nsfwResult.avarage_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);

        let embed = new RichEmbed()
            .setAuthor(this.user.username, this.user.displayAvatarURL)
            .setColor(color)
            .setTitle(`Skin ${skinID} Rejected`)
            .setDescription(`\`${skinName.replace(/`/g, "\\`")}\` submitted by <@${ownerID}>`)
            .setFooter(`Automatically rejected`)
            .setTimestamp();
        
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

        // Don't laugh
        for (let i in pendingSkins) {
            let skinDoc = pendingSkins[i];

            let statusMessage = await this.getReviewMessage(skinDoc);

            let approvedReactions = statusMessage.reactions.get(this.config.approveEmoji);
            let rejectReactions   = statusMessage.reactions.get(this.config.rejectEmoji);

            let approveCount = await this.filterModReaction(approvedReactions);
            let rejectCount  = await this.filterModReaction(rejectReactions);

            if (approveCount >= this.config.approveThreshold) {

                await this.approvePending(skinDoc, approvedReactions);

            } else if (rejectCount >= this.config.rejectThreshold) {

                await this.rejectPending(skinDoc, rejectReactions);

            } else continue;

            statusMessage.deletable && (await statusMessage.delete().catch(() => {}));
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

            let extra = approvedReactions ? `This skin was approved by: \n**` + 
                                            approvedReactions.users.filter(u => u !== this.user)
                                                                .map(u => `<@${u.id}>`).join(" ") + "**\n" :
                                            `Batch approved`;

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

            let message = await this.approvedChannel.send(embed);
            skinDoc.messageID = message.id;
            await skinDoc.save();

            let user = this.findUserByID(skinDoc.ownerID);

            if (user) {

                let skinEmbed = new RichEmbed()
                    .setTitle("Your skin was approved!")
                    .setColor("GREEN")
                    .setDescription(`Skin URL: **\`${this.config.webDomain}/s/${skinDoc.skinID}\`**`)
                    .setFooter("Thanks for using this app")
                    .setTimestamp();

                if (this.config.env === "production") {
                    let url = `${this.config.webDomain}/s/${skinDoc.skinID}`;
                    skinEmbed.setThumbnail(url).setURL(url);
                } else {
                    // dev
                    skinEmbed.attachFile(new Attachment(`${SKIN_STATIC}/${skinDoc.skinID}.png`, skinDoc.skinName + ".png"));
                }

                try {
                    let dm = await user.createDM();
                    await dm.send(skinEmbed);
                } catch(_) {
                    await this.notifChannel.send(`<@${skinDoc.ownerID}>`, skinEmbed).catch(_ => {});
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
        let extra = rejectReactions ? `This skin was rejected by: \n**` + 
                                        rejectReactions.users.filter(u => u !== this.user)
                                                    .map(u => `<@${u.id}>`).join(" ") + "**\n" :
                                      "";

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
            embed.attachFile(new Attachment(`${DELETED_SKIN_STATIC}/${skinDoc.skinID}`, 
                                            "SPOILER_" + skinDoc.skinName + ".png"));
        }

        /** @type {DiscordJS.Message} */
        let message = await this.rejectedChannel.send(embed);

        skinDoc.messageID = message.id;
        await skinDoc.save();

        let user = this.findUserByID(skinDoc.ownerID);

        if (user) {

            let skinEmbed = new RichEmbed()
                .setTitle("Your skin was rejected!")
                .setColor("RED")
                .setImage(message.embeds[0].image.proxyURL)
                .setDescription(`You may ask moderators why this skin was rejected.`)
                .setTimestamp();

            try {
                let dm = await user.createDM();
                await dm.send(skinEmbed);
            } catch(_) {
                await this.notifChannel.send(`<@${skinDoc.ownerID}>`, skinEmbed).catch(this.logger.onError);
            }
        }
    }

    /** 
     * @param {string} messageID
     * @param {SkinStatus} status
     * @param {string} newURL
     */
    async deleteReview(messageID, status, newURL) {
        if (!messageID) return (this.logger.warn("DeleteReview: undefined messageID"), false);
        /** @type {DiscordJS.Message} */
        let message = await this[`${status}Channel`].fetchMessage(messageID).catch(() => {});

        if (!message) {
            for (let possibleStatus of ["approved","rejected","pending","deleted"]) {
                if (status == possibleStatus) continue;
                message = await this[`${possibleStatus}Channel`]
                    .fetchMessage(messageID).catch(() => {});
                if (message) break;
            }
        }

        if (!message) return (this.logger.warn("DeleteReview: can NOT find review message"), false);

        let embed = this.copyEmbed(message.embeds[0]);

        if (newURL) {
            embed.setThumbnail(newURL);
            embed.setImage("");
        }

        embed.title = embed.title.replace(new RegExp(status, "i"), "Deleted");

        await this.deletedChannel.send(embed);

        message.deletable && (await message.delete());
        return true;
    }

    /** @param {DiscordJS.MessageEmbed} embed */
    copyEmbed(embed) {

        let copy = new RichEmbed();

        embed.author && (copy.setAuthor(embed.author.name, embed.author.iconURL))
        embed.color  && (copy.setColor(embed.color));
        embed.title  && (copy.setTitle(embed.title));
        embed.description && (copy.setDescription(embed.description));
        embed.thumbnail   && (copy.setThumbnail(embed.thumbnail.url));
        embed.footer && (copy.setFooter(embed.footer.text));
        embed.image  && (copy.setImage(embed.image.url));
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
