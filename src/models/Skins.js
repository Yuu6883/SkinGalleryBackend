const mongoose = require("mongoose");

/** @type {mongoose.Schema<SkinEntry>} */
const SkinSchema = new mongoose.Schema({
    skinID:         { type: String, required: true },
    ownerID:        { type: String, required: true },
    skinName:       { type: String, required: true },
    createdStamp:   { type: Date, default: Date.now },
    approvedStamp:  { type: Date, required: false }
});
SkinSchema.index({ skinID: 1 }, { unique: true });
SkinSchema.index({ ownerID: 1 }, { unique: true });
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
    async find(skinID) {
        return await SkinModel.findOne({ skinID });
    }

    /**
     * @param {string} ownerID
     * @param {string} skinName
     */
    async create(ownerID, skinName) {
        let skinID;
        // Duplicate check
        while (await this.find(skinID = this.app.unique.generateSkinId()) == null)
            ;
        return await SkinModel.create({ skinID, ownerID, skinName });
    }

    /**
     * @param {string} skinID
     */
    async approve(skinID) {
        const doc = await SkinCollection.find(skinID);
        if (doc == null) return false;
        doc.approvedStamp = new Date();
        await doc.save();
        return true;
    }
    /**
     * @param {string} skinID
     */
    async reject(skinID) {
        const doc = await SkinCollection.find(skinID);
        if (doc == null) return false;
        await doc.remove();
        return true;
    }

    /**
     * @param {string} skinID
     */
    async editSkinName(skinID) {
        const doc = await SkinCollection.find(skinID);
        if (doc == null) return false;
        doc.approvedStamp = new Date();
        await doc.save();
        return true;
    }
}

module.exports = SkinCollection;
