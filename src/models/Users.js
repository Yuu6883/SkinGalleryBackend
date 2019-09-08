const mongoose = require("mongoose");

/** @type {mongoose.Schema<UserEntry>} */
const UserSchema = new mongoose.Schema({
    discordID:      { type: String, required: true },
    discordToken:   { type: String, required: false },
    discordRefresh: { type: String, required: false },
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
        const user = await this.find(discordID);
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
     * @param {string} discordID
     */
    async count(discordID) {
        return await UserModel.countDocuments({ discordID });
    }
    /**
     * @param {string} vanisToken
     */
    async countAuthedVanis(vanisToken) {
        return await UserModel.countDocuments({ vanisToken });
    }

    /**
     * @param {string} discordID
     * @param {string} discordToken
     * @param {string} discordRefresh
     */
    async authorize(discordID, discordToken, discordRefresh) {
        const user = await this.findOrCreate(discordID);
        if (user == null) return null;
        user.discordToken = discordToken;
        user.discordRefresh = discordRefresh;

        const token = await this.app.provision.generateVanisToken();
        user.vanisToken = token;
        await user.save();

        return token;
    }
    /**
     * @param {string} discordID
     */
    async deauthorize(discordID) {
        const user = await this.find(discordID);
        if (user == null) return false;
        user.discordToken = undefined;
        user.discordRefresh = undefined;
        user.vanisToken = undefined;
        await user.save();
        return true;
    }
}

module.exports = UserCollection;
