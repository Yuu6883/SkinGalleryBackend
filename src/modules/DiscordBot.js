const DiscordJS = require("discord.js");
const fs = require("fs");
const { Attachment, RichEmbed } = DiscordJS;

const table = require("./StringTable");
const { SKIN_STATIC, PENDING_SKIN_STATIC } = require("../constant");

class VanisSkinsDiscordBot extends DiscordJS.Client {
    /**
     * @param {App} app
     * @param {DiscordJS.ClientOptions} options
     */
    constructor(app, options) {
        super(options);
        this.app = app;
        this.enabled = false;
        this.prefix = app.config.prefix || "!";
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    async init() {
        await this.login(this.config.discordBotToken);
        this.logger.inform(`Discord bot (${this.user.username}#${this.user.discriminator}) logged in`);

        /** @type {DiscordJS.TextChannel} */
        this.pendingChannel = this.findChannelByID(this.config.skinPendingChannelID);
        /** @type {DiscordJS.TextChannel} */
        this.approvedChannel = this.findChannelByID(this.config.skinApprovedChannelID);
        /** @type {DiscordJS.TextChannel} */
        this.rejectedChannel = this.findChannelByID(this.config.skinRejectedChannelID);

        if (!this.pendingChannel || !this.approvedChannel || !this.rejectedChannel) 
            throw Error(`Can't find skin channels ${this.config.skinPendingChannelID}`);

        await this.updateMods();
        this.startReviewCycle();

        // this.users.forEach(u => {
        //     console.log(u.username + "#" + u.discriminator + "(" + u.id + ")");
        // });

        this.on("message", message => this.onMessage(message));
    }

    /** @param {DiscordJS.Message} message */
    onMessage(message) {
        if (this.isAdmin(message.author.id) && message.content.startsWith(this.prefix)) 
            this.runCommand(message);
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
                .setDescription(`${skinDoc.skinName}(recovered because last message was deleted)`)
                .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                       `${this.config.rejectThreshold} ${this.config.rejectEmoji} to reject`)
                .attachFile(new Attachment(`${PENDING_SKIN_STATIC}/${skinDoc.skinID}.png`, "SPOILER_" + skinDoc.skinName + ".png"))
                .setTimestamp();

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

    /**
     * @param {string} ownerID 
     * @param {NSFWPrediction} nsfwResult 
     * @param {string} skinID
     * @param {string} skinName 
     */
    async pendSkinReview(ownerID, nsfwResult, skinID, skinName) {

        for (let i in nsfwResult) {
            nsfwResult[i] = isNaN(nsfwResult[i]) ? nsfwResult[i] : 
                            Number.isInteger(nsfwResult[i]) ? nsfwResult[i] : (nsfwResult[i] * 100).toFixed(2) + "%";
        }

        let color = nsfwResult.avarage_color.replace(/\D/g, " ").match(/\S+/g).map(c => ~~c);

        let embed = new RichEmbed()
            .setColor(color)
            .setDescription(`**NSFW Prediction of \`${skinName}\` submitted by <@${ownerID}> (${skinID}):**` + 
                            `\n\`\`\`\n${table(nsfwResult)}\`\`\``)
            .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                       `${this.config.rejectThreshold} ${this.config.rejectEmoji} to reject`)
            .attachFile(new Attachment(nsfwResult.data, `SPOILER_${skinName}.png`))
            .setTimestamp();

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
            .setTitle("Skin Approved")
            .setDescription(`Skin **${skinName}**(submitted by <@${ownerID}>)(${skinID})`)
            .setFooter(`Automatically approved`)
            .setTimestamp();

        if (this.config.env === "production") {
            embed.setThumbnail(`https://skins.vanis.io/s/${skinID}`);
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
            .setTitle("Skin Rejected")
            .setDescription(`Skin **${skinName}** submitted by <@${ownerID}> (${skinID})`)
            .setFooter(`Automatically rejected`)
            .attachFile(new Attachment(nsfwResult.data, `SPOILER_${skinName}.png`))
            .setTimestamp();
            
        /** @type {DiscordJS.Message} */
        let message = await this.rejectedChannel.send(embed);
        return message.id;
    }

    async updateReview() {

        let pendingSkins = await this.app.skins.getPending();
        this.logger.debug(`Checking ${pendingSkins.length} pending reviews...`);

        // Don't laugh
        for (let i in pendingSkins) {
            let skinDoc = pendingSkins[i];

            let statusMessage = await this.getReviewMessage(skinDoc);

            let approvedReactions = statusMessage.reactions.get(this.config.approveEmoji);
            let rejectReactions = statusMessage.reactions.get(this.config.rejectEmoji);

            let approveCount = await this.filterModReaction(approvedReactions);
            let rejectCount = await this.filterModReaction(rejectReactions);

            if (approveCount >= this.config.approveThreshold) {

                skinDoc.status = "approved";
                await skinDoc.save();

                let success = this.moveApprovedSkin(skinDoc.skinID);

                if (success) {

                    let embed = new RichEmbed()
                        .setTitle("Skin Approved")
                        .setDescription(`Skin ${skinDoc.skinName} submitted by <@${skinDoc.ownerID}>` +
                                        ` (${skinDoc.skinID}) was approved by: \n**` + 
                                         approvedReactions.users.filter(u => u !== this.user)
                                                                .map(u => `<@${u.id}>`).join(" ") + "**\n")
                        .setTimestamp();

                    if (this.config.env === "production") {
                        embed.setThumbnail(`https://skins.vanis.io/s/${skinDoc.skinID}`);
                    }

                    await this.pendingChannel.send(embed);
                } else await this.pendingChannel.send(`Error: can't find skin ${skinDoc.skinName}(${skinDoc.skinID})`);

            } else if (rejectCount >= this.config.rejectThreshold) {

                skinDoc.status = "rejected";
                await skinDoc.save();

                let embed = new RichEmbed()
                        .setTitle("Skin Rejected")
                        .setDescription(`Skin ${skinDoc.skinName} submitted by <@${skinDoc.ownerID}> ` +
                                        `(${skinDoc.skinID}) was rejected by: \n**` + 
                                         rejectReactions.users.filter(u => u !== this.user)
                                                              .map(u => `<@${u.id}>`).join(" ") + "**\n")
                        .setTimestamp();

                await this.rejectedChannel.send(embed);

            } else continue;

            statusMessage.deletable && (await statusMessage.delete().catch(() => {}));
        }
    }

    /** @param {string} messageID */
    async deleteReview(messageID) {
        let message = await this.pendingChannel.fetchMessage(messageID).catch(() => {});
        
        if (!message) return false;

        message.editable && message.edit("Skin Deleted");
        return true;
    }

    /** @param {string} skinID */
    moveApprovedSkin(skinID) {
        let sourcePath = `${PENDING_SKIN_STATIC}/${skinID}.png`;
        let distPath = `${SKIN_STATIC}/${skinID}.png`;

        if (!fs.existsSync(sourcePath)) {
            this.logger.onError(`Can't find skin at ${sourcePath} while approving`);
            return false;
        }

        fs.renameSync(sourcePath, distPath);
        return true;
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
            }
            else count++;
        }

        return count;
    }

    async updateMods() {
        this.modsCache = (await this.app.users.getMods()).map(d => d.discordID);
        this.modsCacheTimestamp = Date.now();
        // console.log("MODS: ", this.modsCache);
        return false;
    }

    /** @param {string} discordID */
    isAdmin(discordID) { return this.config.admins.includes(discordID) }

    /** @param {string} discordID */
    async addMod(discordID) {
        let r = await this.app.users.addMod(discordID);
        await this.updateMods();
        return r;
    }

    /** @param {string} discordID */
    async removeMod(discordID) {
        let r = await this.app.users.removeMod(discordID);
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
        await this.destroy();
        this.logger.inform("Discord bot logged out");
    }
}

module.exports = VanisSkinsDiscordBot;

const App = require("../app");
