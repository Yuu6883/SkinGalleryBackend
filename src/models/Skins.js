const mongoose = require("mongoose");

/** @type {mongoose.Schema<SkinEntry>} */
const SkinSchema = new mongoose.Schema({
    skinID:         { type: String, required: true },
    ownerID:        { type: String, required: true },
    skinName:       { type: String, required: true },
    messageID:      { type: String, required: false },
    status:         { type: String, default: "pending", enum: [ "pending", "rejected", "approved" ] }
});

SkinSchema.index({ skinID: 1 }, { unique: true });
SkinSchema.index({ ownerID: 1 });
SkinSchema.index({ skinName: "text" });

/** @type {mongoose.Model<SkinDocument, {}>} */
const SkinModel = mongoose.model("skins", SkinSchema);

class SkinCollection {
    /**
     * @param {import("../App")} app
     */
    constructor(app) {
        this.app = app;
    }

    /**
     * @param {string} skinID
     */
    async findBySkinID(skinID) {
        return await SkinModel.findOne({ skinID });
    }

    /**
     * @param {string} ownerID
     */
    async findByOwnerID(ownerID) {
        const projection = { skinID: true, status: true, skinName: true, _id: false };
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
     * @returns {SkinDocument}
     */
    async create(ownerID, skinName, status = "pending") {
        return SkinModel.create({
            skinID: await this.app.provision.generateSkinID(),
            ownerID,
            skinName,
            status
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
     * @param {string} skinID
     * @param {string} name
     */
    async editName(skinID, name) {
        const doc = await this.findBySkinID(skinID);
        if (doc == null) return false;
        doc.skinName = name;
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
