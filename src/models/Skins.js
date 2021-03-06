const mongoose = require("mongoose");
const SkinCache = require("./SkinCache");
const TIME_0 = SkinCache.TIME_0;

/** @type {mongoose.Schema<SkinEntry>} */
const SkinSchema = new mongoose.Schema({
    skinID:         { type: String,  required: true  },
    ownerID:        { type: String,  required: true  },
    skinName:       { type: String,  required: true  },
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
        this.TIME_0 = TIME_0;

        if (this.app.config.env == "development")
            this.model = SkinModel;

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
        // Limit operation at most once every 15 seconds
        if (force || Date.now() - this.publicRefreshTimestamp >= 15 * 1000) {
            this.publicRefreshTimestamp = Date.now();
            this.stopUpdatePublic();
            return this.startUpdatePublic();
        }
    }

    async updatePublic() {
        this.publicCache.createCache(await SkinModel.find({ status: "approved", public: true }));
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
    async findByOwnerID(ownerID, mutable = false) {
        if (mutable) return await SkinModel.find({ ownerID });
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
     */
    async approvedCountByOwnerID(ownerID) {
        return await SkinModel.countDocuments({ ownerID, status: "approved" });
    }

    /**
     * @param {string} ownerID
     */
    async pendingCountByOwnerID(ownerID) {
        return await SkinModel.countDocuments({ ownerID, status: "pending" });
    }

    /**
     * @param {string} ownerID
     * @param {string} skinName
     * @param {SkinStatus} status
     * @returns {SkinDocument}
     */
    async create(ownerID, skinID, skinName, status = "pending", publicSkin = true) {
        
        return SkinModel.create({
            skinID,
            ownerID,
            skinName,
            status,
            public: publicSkin
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
     * @param {String[]} ids 
     * @returns {ClientSkin[]}
     */
    async findAll(ids) {
        return await SkinModel.aggregate([{
            $match:   {
                $and: [ 
                    { public: true },
                    { status: "approved" },
                    { skinID: { $in: ids } },
                ]
            }
        },
        {   
            $project: { _id: 0, ownerID: 1, skinName: 1, skinID: 1,
                        createdAt: 1, favorites: 1, tags: 1 }
        }]).exec();
    }

    /**
     * @param {{ skinID: string, name: string, isPublic: boolean }} param0
     */
    async edit({ skinID, name, isPublic }) {
        const doc = await this.findBySkinID(skinID);
        if (doc == null) return false;
        doc.skinName = name;
        doc.public = !!isPublic;
        if (!isPublic) doc.favorites = 0;
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

    getRandom() {
        let randomIndex = ~~(Math.random() * this.publicCache.cacheLength);
        let skin = this.publicCache.readCache(this.publicCache.sortByTime
            .slice(randomIndex * this.publicCache.BYTES_PER_SKIN, (randomIndex + 1) * this.publicCache.BYTES_PER_SKIN))[0];
        return skin;
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
