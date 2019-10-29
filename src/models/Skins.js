const mongoose = require("mongoose");
const SkinCache = require("./SkinCache");
const TIME_0 = 1546243200000;

/** @type {mongoose.Schema<SkinEntry>} */
const SkinSchema = new mongoose.Schema({
    skinID:         { type: String,  required: true  },
    ownerID:        { type: String,  required: true  },
    skinName:       { type: String,  required: true  },
    messageID:      { type: String,  required: false },
    status:         { type: String,  default: "pending", enum: [ "pending", "rejected", "approved" ] },
    public:         { type: Boolean, default: false },
    favorites:      { type: Number,  default: 0 },
    tags:           { type: [String], default: ["other"] },
    createdAt:      { type: Number }
});

SkinSchema.pre("save", function() {
    this.createdAt = this.createdAt || Date.now();
    // UINT32_MAX
    if (this.createdAt > 2 ** 32 - 1) {
        this.createdAt = Math.round((this.createdAt - TIME_0) / 1000);
    }
});

SkinSchema.post("init", doc => {
    doc.createdAt = doc.createdAt || Date.now();
    // UINT32_MAX
    if (doc.createdAt > 2 ** 32 - 1) {
        doc.createdAt = Math.round((doc.createdAt - TIME_0) / 1000);
    }
});

SkinSchema.index({ skinID: 1 }, { unique: true });
SkinSchema.index({ ownerID: 1 });

/** @type {mongoose.Model<SkinDocument, {}>} */
const SkinModel = mongoose.model("skins", SkinSchema);

class SkinCollection {
    /**
     * @param {import("../App")} app
     */
    constructor(app) {
        this.app = app;
        this.publicRefreshTimestamp = 0;
        /** @type {SkinDocument[]} */
        this.publicSkins = [];
        this.TIME_0 = TIME_0;

        this.publicCache = new SkinCache(app);
    }

    startUpdatePublic() {
        const u = async () => {
            await this.updatePublic();
            this.publicTimeout = setTimeout(u, this.app.config.publicUpdateInterval);
        };
        return u();
    }

    stopUpdatePublic() {
        this.publicTimeout && clearTimeout(this.publicTimeout);
    }

    restartUpdatePublic(force) {
        // Limit operation at most once every 10 seconds
        if (force || Date.now() - this.publicRefreshTimestamp >= 10 * 1000) {
            this.publicRefreshTimestamp = Date.now();
            this.stopUpdatePublic();
            return this.startUpdatePublic();
        }
    }

    async updatePublic() {
        this.publicSkins = await SkinModel
            .find({ status: "approved", public: true });
    }

    get publicSkinCount() { return this.publicSkins.length }

    /**
     * 
     * @param {{ page: number, tag: string, sort: string }} param0 
     */
    getPublicSkins({page = 0, tag, sort = "" }) {
        let lim = this.app.config.publicPageLimit;

        let filtered = this.publicSkins
            // Make sure the tag exists then filter it
            .filter(obj => (tag && this.app.config.tags.includes(tag)) ? 
                            obj.tags.includes(tag) : true);

        let factor = sort[0] == "-" ? 1 : -1;
        switch (sort) {
            case "time":
            case "-time":
                filtered = filtered.sort((a, b) => factor * (a.createdAt - b.createdAt));
                break;
            case "name":
            case "-name":
                filtered = filtered.sort((a, b) => factor * (a.skinName.localeCompare(b)));
                break;
            case "fav":
                filtered = filtered.sort((a, b) => factor * (a.favorites - b.favorites));
                break;
        }
        
        let total = filtered.length;

        return {
            skins: filtered
                .slice(~~page * lim, (~~page + 1) * lim)
                .map(skinDoc => ({
                    id:   skinDoc.skinID,
                    name: skinDoc.skinName,
                    tags: skinDoc.tags,
                    favorites: skinDoc.favorites,
                    timestamp: skinDoc.createdAt
                })),
            total
        };
    }

    /**
     * @param {string} skinID
     */
    async findBySkinID(skinID) {
        return await SkinModel.findOne({ skinID });
    }

    /**
     * @param {string} ownerID
     * @returns {ClientSkin[]}
     */
    async findByOwnerID(ownerID) {
        const projection = { skinID: true, status: true, skinName: true, tags: true, 
            public: true, createdAt: true, favorites: true, _id: false };
        return await SkinModel.find({ ownerID }, projection);
    }

    /**
     * @param {string} ownerID
     * @param {string} skinID 
     */
    async checkOwnership(ownerID, skinID) {
        return (await SkinModel.findOne({ ownerID, skinID })) !== null;
    }

    /**
     * @param {string} skinID
     */
    async countBySkinID(skinID) {
        return await SkinModel.countDocuments({ skinID });
    }
    /**
     * @param {string} ownerID
     */
    async countByOwnerID(ownerID) {
        return await SkinModel.countDocuments({ ownerID });
    }

    /**
     * @param {string} ownerID
     * @param {string} skinName
     * @param {SkinStatus} status
     * @param {string} messageID
     * @returns {SkinDocument}
     */
    async create(ownerID, skinID, skinName, status = "pending", publicSkin = true, messageID) {
        
        if (await this.countByOwnerID(ownerID) >= this.app.config.skinLimit) {
            return null;
        }

        return SkinModel.create({
            skinID,
            ownerID,
            skinName,
            status,
            public: publicSkin,
            messageID
        });
    }

    /**
     * @param {string} skinID
     * @param {SkinStatus} status
     */
    async setState(skinID, status) {
        const doc = await this.findBySkinID(skinID);
        if (doc == null) return false;
        doc.status = status;
        await doc.save();
        return true;
    }

    /**
     * @param {{ skinID: string, name: string, isPublic: boolean }} param0
     */
    async edit({ skinID, name, isPublic }) {
        const doc = await this.findBySkinID(skinID);
        if (doc == null) return false;
        doc.skinName = name;
        doc.public = !!isPublic;
        await doc.save();
        return true;
    }

    /**
     * @param {string} skinID
     */
    async deleteByID(skinID) {
        return (await SkinModel.deleteOne({ skinID })).deletedCount === 1;
    }

    async getPending() {
        return await SkinModel.find({ status: "pending" });
    }

    /**
     * @param {string} ownerID
     */
    async dropByOwnerID(ownerID) {
        return await SkinModel.deleteMany({ ownerID });
    }

    async dropAll() {
        if (this.app.config.env === "production")
            throw new Error("Call to drop all skin documents in production environment")
        return await SkinModel.deleteMany({});
    }
}

module.exports = SkinCollection;
