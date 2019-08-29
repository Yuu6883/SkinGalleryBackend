const mongoose = require("mongoose");
const uniqid = require("uniqid");

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
const SkinModel = mongoose.model("users", SkinSchema);

class SkinCollection {
    /**
     * @param {string} skinID
     */
    static async find(skinID) {
        return await SkinModel.findOne({ skinID });
    }

    /**
     * @param {string} ownerID
     * @param {string} skinName
     */
    static async create(ownerID, skinName) {
        const skinID = uniqid();
        return await SkinModel.create({ skinID, ownerID, skinName });
    }

    /**
     * @param {string} skinID
     */
    static async approve(skinID) {
        const doc = await SkinCollection.find(skinID);
        if (doc == null) return false;
        doc.approvedStamp = new Date();
        await doc.save();
        return true;
    }
    /**
     * @param {string} skinID
     */
    static async reject(skinID) {
        const doc = await SkinCollection.find(skinID);
        if (doc == null) return false;
        await doc.remove();
        return true;
    }

    /**
     * @param {string} skinID
     */
    static async editSkinName(skinID) {
        const doc = await SkinCollection.find(skinID);
        if (doc == null) return false;
        doc.approvedStamp = new Date();
        await doc.save();
        return true;
    }
}

module.exports = SkinCollection;
