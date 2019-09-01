const mongoose = require("mongoose");

/** @type {mongoose.Schema<UserEntry>} */
const UserSchema = new mongoose.Schema({
    discordID:      { type: String, required: true },
    discordToken:   { type: String, required: false },
    vanisToken:     { type: String, required: false },
    bannedUntil:    { type: Date, required: false },
    moderator:      { type: Boolean, default: false }
});
UserSchema.index({ discordID: 1 }, { unique: true });
UserSchema.index({ discordToken: 1 }, { unique: true, sparse: true });
UserSchema.index({ vanisToken: 1 }, { unique: true, sparse: true });

/** @type {mongoose.Model<UserDocument, {}>} */
const UserModel = mongoose.model("users", UserSchema);

class UserCollection {
    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * @param {string} discordID
     */
    async find(discordID) {
        return await UserModel.findOne({ discordID });
    }
    /**
     * @param {string} discordID
     */
    async findOrCreate(discordID) {
        const user = await UserCollection.find(discordID);
        if (user != null) return user;
        return await UserModel.create({ discordID });
    }

    /**
     * @param {string} vanisToken
     */
    async findAuthedVanis(vanisToken) {
        return await UserModel.findOne({ vanisToken });
    }
    /**
     * @param {string} vanisToken
     */
    async countAuthedVanis(vanisToken) {
        return await UserModel.count({ vanisToken });
    }
    /**
     * @param {string} discordToken
     */
    async findAuthedDiscord(discordToken) {
        return await UserModel.findOne({ discordToken });
    }

    /**
     * @param {string} discordID
     */
    async authVanis(discordID) {
        const doc = await this.find(discordID);
        if (doc == null) return null;
        const token = this.app.provisionion.generateVanisToken();
        doc.vanisToken = token;
        await doc.save();
        return token;
    }
    /**
     * @param {string} discordID
     * @param {string} discordToken
     */
    async authDiscord(discordID, discordToken) {
        const user = await this.find(discordID);
        if (user == null) return null;
        user.discordToken = discordToken;
        await user.save();
    }
    /**
     * @param {string} discordID
     */
    async deauthVanis(discordID) {
        const user = await this.find(discordID);
        if (user == null) return false;
        user.vanisToken = undefined;
        await user.save();
        return true;
    }
    /**
     * @param {string} discordID
     */
    async deauthDiscord(discordID) {
        const user = await this.find(discordID);
        if (user == null) return false;
        if (user.discordToken == null) return false;
        user.discordToken = undefined;
        await user.save();
        return true;
    }
}

module.exports = UserCollection;
