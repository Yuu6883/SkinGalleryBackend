const mongoose = require("mongoose");

/** @type {mongoose.Schema<UserEntry>} */
const UserSchema = new mongoose.Schema({
    discordID:      { type: String, required: true  },
    discordToken:   { type: String, required: false },
    discordRefresh: { type: String, required: false },
    vanisToken:     { type: String, required: false },
    bannedUntil:    { type: Date,   required: false },
    moderator:      { type: Boolean, default: false },
    favorites:      { type: [String], default: []   }
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
        this.app.logger.debug(`Creating new user document id: ${discordID}`);
        return await UserModel.create({ discordID });
    }

    async getMods() {
        return await UserModel.find({ moderator: true });
    }

    /**
     * @param {string} discordID
     */
    async isMod(discordID) {
        return (await this.findOrCreate(discordID)).moderator;
    }

    /**
     * @param {string} discordID
     */
    async addMod(discordID) {
        const user = await this.findOrCreate(discordID);
        if (user.moderator) return false;
        user.moderator = true;
        await user.save();
        return true;
    }

    /**
     * @param {string} discordID
     */
    async removeMod(discordID) {
        const user = await this.findOrCreate(discordID);
        if (!user.moderator) return false;
        user.moderator = false;
        await user.save();
        return false;
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
     * @param {string} discordID 
     */
    async ban(discordID, banTime = 3 * 24 * 60 * 60 * 1000) {
        let userDoc = await this.find(discordID);
        if (!userDoc) return;
        userDoc.bannedUntil = new Date(Date.now() + banTime);
        await userDoc.save();
        return true;
    }

    /**
     * @param {string} discordID 
     */
    async unban(discordID) {
        let userDoc = await this.find(discordID);
        if (!userDoc) return;
        userDoc.bannedUntil = new Date(0, 0, 0);
        await userDoc.save();
        return true;
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

    async dropAll() {
        return await UserModel.deleteMany({});
    }
}

module.exports = UserCollection;
