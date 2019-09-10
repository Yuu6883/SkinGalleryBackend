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
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    async init() {
        await this.login(this.config.discordBotToken);
        this.logger.inform(`Discord bot (${this.user.username}#${this.user.discriminator}) logged in`);

        /** @type {DiscordJS.TextChannel} */
        this.reviewChannel = this.findChannelByID(this.config.skinReviewChannelID);

        if (!this.reviewChannel) 
            throw Error(`Can't find skin review channel ${this.config.skinReviewChannelID}`);

        await this.updateMods();
        this.startReviewCycle();

        // this.users.forEach(u => {
        //     console.log(u.username + "#" + u.discriminator + "(" + u.id + ")");
        // });
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
            message = await this.reviewChannel.fetchMessage(skinDoc.messageID).catch(() => {});

        let skinOwner = this.findUserByID(skinDoc.ownerID);

        // Bruh moment
        if (!skinOwner) {
            await skinDoc.remove();
            this.logger.onError(`Can't find skin owner of ID ${skinDoc.ownerID}`);
            skinOwner = {
                id: "bruh",
                displayAvatarURL: "https://discordapp.com/assets/dd4dbc0016779df1378e7812eabaa04d.png",
                username: "Hacker",
                discriminator: "6969"
            }
        }

        // Somehow the message is gone by magik
        if (!message) {

            let embed = new RichEmbed()
                .setTitle(`${skinOwner.username}#${skinOwner.discriminator}` + 
                          `(${skinOwner.id})`, skinOwner.displayAvatarURL)
                .setDescription(`${skinDoc.skinName}(recovered because last message was deleted)`)
                .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                       `${this.config.rejectThreshold} ${this.config.rejectEmoji} to reject`)
                .attachFile(new Attachment(`${PENDING_SKIN_STATIC}/${skinDoc.skinID}.jpg`, "SPOILER_" + skinDoc.skinName + ".jpg"))
                .setTimestamp();

            message = await this.reviewChannel.send(embed);

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
     * @param {string} skinPath 
     * @param {string} skinName 
     */
    async pendSkinReview(ownerID, nsfwResult, skinPath, skinName) {
        let skinOwner = this.findUserByID(ownerID);

        if (!skinOwner) {
            this.logger.warn(`Can't find user ID ${ownerID} while pending skin to reivew`);
            return;
        }

        for (let i in nsfwResult) {
            nsfwResult[i] = (nsfwResult[i] * 100).toFixed(2) + "%";
        }

        let embed = new RichEmbed()
            .setAuthor(`${skinOwner.username}#${skinOwner.discriminator}` + 
                       `(${skinOwner.id})`, skinOwner.displayAvatarURL)
            .setDescription(`**NSFW Prediction of __${skinName}__:**\n\`\`\`\n${table(nsfwResult)}\`\`\`` + 
                            ``)
            .setFooter(`${this.config.approveThreshold} ${this.config.approveEmoji} to approve | ` + 
                       `${this.config.rejectThreshold} ${this.config.rejectEmoji} to reject`)
            .setTimestamp()
            .attachFile(new Attachment(skinPath, skinName));

        /** @type {DiscordJS.Message} */
        let message = await this.reviewChannel.send(embed);

        await message.react(this.config.approveEmoji);
        await message.react(this.config.rejectEmoji);

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
                        .setDescription(`Skin ${skinDoc.skinName}(${skinDoc.skinID}) was approved by: \n**` + 
                                         approvedReactions.users.filter(u => u !== this.user).map(u => `<@${u.id}>`).join(" ") + "**\n")
                        .setTimestamp();

                    if (this.config.env === "production") {
                        embed.setThumbnail(`https://skin.yuu.studio/s/${skinDoc.skinID}`);
                    }

                    await this.reviewChannel.send(embed);
                } else await this.reviewChannel.send(`Error: can't find skin ${skinDoc.skinName}(${skinDoc.skinID})`);

            } else if (rejectCount >= this.config.rejectThreshold) {

                skinDoc.status = "rejected";
                await skinDoc.save();
                await this.reviewChannel.send(`${skinDoc.skinName}(${skinDoc.skinID}) ${this.config.rejectEmoji}`);

            } else continue;

            statusMessage.deletable && (await statusMessage.delete().catch(() => {}));
        }
    }

    /** @param {string} messageID */
    async deleteReview(messageID) {
        let message = await this.reviewChannel.fetchMessage(messageID).catch(() => {});
        
        if (!message) return false;

        message.deletable && (await message.delete().catch(() => {}));
        return true;
    }

    /** @param {string} skinID */
    moveApprovedSkin(skinID) {
        let sourcePath = `${PENDING_SKIN_STATIC}/${skinID}.jpg`;
        let distPath = `${SKIN_STATIC}/${skinID}.jpg`;

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

            if (!(await this.isMod(user.id)))
                await reaction.remove(user);
            else count++;
        }

        return count;
    }

    async updateMods() {
        this.modsCache = (await this.app.users.getMods()).map(d => d.discordID);
        this.modsCacheTimestamp = Date.now();
    }

    /** @param {string} discordID */
    isAdmin(discordID) { this.config.admins.includes(discordID) }

    /** @param {string} discordID */
    async addMod(discordID) {
        return (await this.app.users.addMod(discordID)) && this.updateMods() || true;
    }

    /** @param {string} discordID */
    async removeMod(discordID) {
        return (await this.app.users.removeMod(discordID)) && this.updateMods() || true;
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
