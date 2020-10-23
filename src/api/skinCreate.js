const { hasPermission, PENDING_SKIN_STATIC, SKIN_STATIC } = require("../constant");
const fs = require("fs");
const NSFWStatus = require("../modules/NSFWStatus");
const expressForms = require("body-parser");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("UPLOAD_SKIN", req.permissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinName(req.params.skinName))
            return void res.sendStatus(400);

        if (!this.provision.confirmPNG(req.body))
            return void res.sendStatus(400);

        if ((await this.skins.countByOwnerID(req.user.discordID)) >= (req.user.limit || this.config.skinLimit)) {
            this.logger.warn(`User ${req.user.discordID} tried to create more than ${this.config.skinLimit} skins`);
            return void res.json({ error: `You have maximum of ${this.config.skinLimit} slots for skins` });
        }

        if (this.config.limitPending) {
            let limit = await this.skins.approvedCountByOwnerID(req.user.discordID);
            limit = Math.ceil((limit + 1) / 10);
            let curr  = await this.skins.pendingCountByOwnerID(req.user.discordID);

            if (curr >= limit)
                return void res.json({ error: `You can have at most ${limit} pending skin` });
        }

        try {

            /** @type {NSFWPrediction} */
            let result = {};
            if (!this.config.disableAutoApprove) {
                result = await this.nsfwBot.classify(req.body);
            }
            let nsfwStatus = NSFWStatus(result);

            let skinID = await this.provision.generateSkinID();
            let imageBase64Data = req.body.replace("data:image/png;base64,", "");
            
            let cucked = false;

            // CUCKED
            if (nsfwStatus == "approved" && 
                this.provision.createdRecently(req.user.discordID)) {
                nsfwStatus = "pending";
                cucked = true;
            }

            let skinPath = (nsfwStatus === "approved" ? SKIN_STATIC : PENDING_SKIN_STATIC) 
                        + "/" + skinID + ".png";
            fs.writeFileSync(skinPath, imageBase64Data, "base64");

            if (nsfwStatus === "pending") {
                this.bot.pendSkin(req.user.discordID, 
                    result, skinID, cucked ? (req.params.skinName + " (new user)") : req.params.skinName);
            }

            if (nsfwStatus === "approved") {
                this.bot.approveSkin(req.user.discordID, result, skinID, req.params.skinName);
            }

            if (nsfwStatus === "rejected") {
                this.bot.rejectSkin(req.user.discordID, result, skinID, req.params.skinName);
            }

            let skinDoc = await this.skins.create(req.user.discordID, skinID, 
                                    req.params.skinName, nsfwStatus, !!req.query.public);

            if (!skinDoc) {
                // Autism strikes
                this.logger.warn(`${req.user.discordID} tried to submit more than limit.`);
                res.sendStatus(403);

                if (fs.existsSync(skinPath))
                    fs.unlinkSync(skinPath);

            } else {

                await this.skins.restartUpdatePublic();

                res.json({
                    id: skinDoc.skinID,
                    skinName: skinDoc.skinName,
                    status: skinDoc.status
                });
            }

        } catch (e) {
            this.logger.warn(`Error occured while running NSFW detection`);
            this.logger.onError(e);

            res.sendStatus(500);
        }

    },
    method: "post",
    path: "/skins/:skinName",
    pre: [expressForms.text({ limit: "2mb", type: "*/*" })],
    closeDuringMaintenance: true
};

module.exports = endpoint;
