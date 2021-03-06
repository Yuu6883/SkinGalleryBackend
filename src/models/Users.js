const mongoose = require("mongoose");

/** @type {mongoose.Schema<UserEntry>} */
const UserSchema = new mongoose.Schema({
    discordID:      { type: String, required: true  },
    discordToken:   { type: String, required: false },
    discordRefresh: { type: String, required: false },
    cacheTimestamp: { type: Number, default: Date.now },
    cacheInfo:      { type: Map,    of: String },
    userToken:     { type: String, required: false },
    bannedUntil:    { type: Date,   required: false },
    bannedReason:   { type: String, required: false },
    moderator:      { type: Boolean,  default: false },
    minimod:        { type: Boolean,  default: false },
    favorites:      { type: [String], default: []   },
    limit:          { type: Number,   default: 60 },
    modScore:       { type: Number,   default: 0  }
});

UserSchema.index({ discordID: 1 },  { unique: true });
UserSchema.index({ userToken: 1 }, { unique: true, sparse: true });

UserSchema.post("init", doc => {
    doc.limit = doc.limit || 60;
    doc.favorites = doc.favorites || [];
});

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

    /**
     * @param {UserDocument} userDoc 
     * @param {string} skinID 
     */
    async addFav(userDoc, skinID) {

        if (userDoc.favorites.includes(skinID)) 
            return {
                success: false,
                error: "You already favorited this skin"
            };

        let skinDoc = await this.app.skins.findBySkinID(skinID);

        if (!skinDoc || skinDoc.status != "approved" || !skinDoc.public)
            return {
                success: false,
                error: "No hacking allowed"
            }

        skinDoc.favorites++;
        userDoc.favorites.push(skinID);
        await Promise.all([skinDoc.save(), userDoc.save()]);

        return {
            success: true,
            skin: {
                tags: skinDoc.tags,
                skinID: skinDoc.skinID,
                status: skinDoc.status,
                ownerID: skinDoc.ownerID,
                skinName: skinDoc.skinName,
                favorites: skinDoc.favorites,
                createdAt: skinDoc.createdAt,
            }
        };
    }

    /**
     * @param {UserDocument} userDoc 
     * @param {string|SkinDocument} skinID 
     */
    async removeFav(userDoc, skinID) {

        let skinDoc = typeof skinID == "string" ? 
            await this.app.skins.findBySkinID(skinID) : skinID;
            
        if (!skinDoc) return false;
        if (!userDoc.favorites.includes(skinID)) return false;
        skinDoc.favorites && skinDoc.favorites--;
        userDoc.favorites.splice(userDoc.favorites.indexOf(skinID), 1);
        await Promise.all([skinDoc.save(), userDoc.save()]);
        return true;
    }

    async getMods() {
        return await UserModel.find({ moderator: true });
    }

    /**
     * @param {string} userID 
     */
    async increModScore(userID) {
        let user = await this.find(userID);
        if (!user || !user.moderator) return;
        user.modScore++;
        await user.save();
        return user;
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
        if (!user.moderator && !user.minimod) return false;
        user.moderator = false;
        user.minimod   = false;
        await user.save();
        return true;
    }

    /**
     * @param {string} discordID
     */
    async isMiniMod(discordID) {
        return (await this.findOrCreate(discordID)).minimod;
    }

    /**
     * @param {string} discordID
     */
    async addMiniMod(discordID) {
        const user = await this.findOrCreate(discordID);
        if (user.minimod) return false;
        user.minimod = true;
        await user.save();
        return true;
    }

    /**
     * @param {string} userToken
     */
    async findAuthed(userToken) {
        return await UserModel.findOne({ userToken });
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
    async ban(discordID, banTime = 3 * 24 * 60 * 60 * 1000, reason = "") {
        let userDoc = await this.find(discordID);
        if (!userDoc) return;
        userDoc.bannedUntil = new Date(Date.now() + banTime);
        userDoc.bannedReason = reason;
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
        userDoc.bannedReason = "";
        await userDoc.save();
        return true;
    }

    /**
     * @param {string} userToken
     */
    async countAuthed(userToken) {
        return await UserModel.countDocuments({ userToken });
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

        const token = await this.app.provision.generateToken();
        user.userToken = token;
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
        user.userToken = undefined;
        await user.save();
        return true;
    }

    async dropAll() {
        return await UserModel.deleteMany({});
    }
}

module.exports = UserCollection;
