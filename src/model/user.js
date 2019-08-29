const mongoose = require("mongoose");
const uniqid = require("uniqid");

/** @type {mongoose.Schema<UserEntry>} */
const UserSchema = new mongoose.Schema({
    discordID:      { type: String, required: true },
    discordToken:   { type: String, required: false },
    vanisToken:     { type: String, required: false },
    bannedUntil:    { type: Date, required: false }
});
UserSchema.index({ discordID: 1 }, { unique: true });
UserSchema.index({ discordToken: 1 }, { unique: true, sparse: true });
UserSchema.index({ vanisToken: 1 }, { unique: true, sparse: true });

/** @type {mongoose.Model<UserDocument, {}>} */
const UserModel = mongoose.model("users", UserSchema);

class UserCollection {
    /**
     * @param {string} discordID
     */
    static async find(discordID) {
        return await UserModel.findOne({ discordID });
    }
    /**
     * @param {string} discordID
     */
    static async findOrCreate(discordID) {
        const user = await UserCollection.find(discordID);
        if (user != null) return user;
        return await UserModel.create({ discordID });
    }

    /**
     * @param {string} vanisToken
     */
    static async findAuthedVanis(vanisToken) {
        return await UserModel.findOne({ vanisToken });
    }
    /**
     * @param {string} discordToken
     */
    static async findAuthedDiscord(discordToken) {
        return await UserModel.findOne({ discordToken });
    }

    /**
     * @param {string} discordID
     */
    static async authVanis(discordID) {
        const doc = await this.find(discordID);
        if (doc == null) return null;
        const id = doc.vanisToken = uniqid();
        await doc.save();
        return id;
    }
    /**
     * @param {string} discordID
     * @param {string} discordToken
     */
    static async authDiscord(discordID, discordToken) {
        const user = await this.find(discordID);
        if (user == null) return null;
        user.discordToken = discordToken;
        await user.save();
    }
    /**
     * @param {string} discordID
     */
    static async deauthVanis(discordID) {
        const user = await this.find(discordID);
        if (user == null) return false;
        user.vanisToken = undefined;
        await user.save();
        return true;
    }
    /**
     * @param {string} discordID
     */
    static async deauthDiscord(discordID) {
        const user = await this.find(discordID);
        if (user == null) return false;
        if (user.discordToken == null) return false;
        user.discordToken = undefined;
        await user.save();
        return true;
    }
}

module.exports = UserCollection;
