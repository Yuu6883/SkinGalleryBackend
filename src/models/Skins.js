const mongoose = require("mongoose");

/** @type {mongoose.Schema<SkinEntry>} */
const SkinSchema = new mongoose.Schema({
    skinID:         { type: String, required: true },
    ownerID:        { type: String, required: true },
    skinName:       { type: String, required: true },
    createdStamp:   { type: Date, default: Date.now },
    approvedStamp:  { type: Date, required: false },
    status:         { type: String, default: "pending" }
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
    findById(skinID) {
        return SkinModel.findOne({ skinID }).exec();
    }

    /**
     * @param {string} ownerID
     */
    findByOwnerID(ownerID) {
        let projection = { skinID: true, status: true, skinName: true, _id: false };
        return SkinModel.find({ ownerID }, projection).exec();
    }

    /** 
     * @param {string} ownerID
     */
    count(ownerID) {
        return SkinModel.countDocuments({ ownerID, status: { $regex: /^(pending)|(approved)$/ } }).exec();
    }

    /** 
     * @param {string} ownerID
     */
    count(ownerID) {
        return SkinModel.countDocuments({ ownerID, status: { $regex: /^(pending)|(approved)$/ } }).exec();
    }

    /**
     * @param {string} ownerID
     * @param {string} skinName
     * @returns {SkinDocument} Skin document created
     */
    create(ownerID, skinName) {

        let skinID = this.app.provision.generateSkinId();
        this.app.logger.debug(`Skin ID: ${skinID}`);

        try {
            return SkinModel.create({ skinID, ownerID, skinName });
        } catch (e) {
            this.app.logger.onError(e);
            return this.create(ownerID, skinName);
        }
    }

    /**
     * @param {string} skinID
     */
    async approve(skinID) {
        const doc = await this.findById(skinID);
        if (doc == null) return false;
        doc.approvedStamp = new Date();
        doc.status = "approved";
        await doc.save();
        return true;
    }
    /**
     * @param {string} skinID
     */
    async reject(skinID) {
        const doc = await this.findById(skinID);
        if (doc == null) return false;
        doc.status = "rejected";
        await doc.save();
        return true;
    }

    /**
     * @param {string} skinID
     * @param {string} newName
     */
    async editSkinName(skinID, newName) {
        const doc = await this.findById(skinID);
        if (doc == null) return false;
        doc.skinName = newName;
        await doc.save();
        return true;
    }

    /** 
     * @param {string} ownerID
     * @returns deleted count
     */
    dropByOwnerID(ownerID) {
        return SkinModel.deleteMany({ ownerID }).exec().then(r => r.deletedCount);
    }

    async dropAll() {
        if (this.app.config.env === "development") {
            let result = await SkinModel.deleteMany({}).exec();
            this.app.logger.warn(`${result.deletedCount} Skin Doument deleted`);
        } else {
            this.app.logger.warn("You shouldn't be dropping DB in production env");
        }
    }
}

module.exports = SkinCollection;
