const { hasPermission, PENDING_SKIN_STATIC, SKIN_STATIC } = require("../constant");
const fs = require("fs");
const expressForms = require("body-parser");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("UPLOAD_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinName(req.params.skinName))
            return void res.sendStatus(400);

        if (!this.provision.confirmJPEG(req.body))
            return void res.sendStatus(400);

        if ((await this.skins.countByOwnerID(req.vanisUser.discordID)) >= 10) {
            this.logger.warn(`User ${req.vanisUser.discordID} tried to create more than 10 skins`);
            return void res.sendStatus({ error: "You have maximum of 10 slots for skins" });
        }

        try {
            let result = await this.nsfwBot.classify(req.body);
            let nsfwStatus = this.nsfwBot.nsfwStatus(result);
            
            let skinDoc = await this.skins.create(req.vanisUser.discordID, req.params.skinName, nsfwStatus);
            let imageBase64Data = req.body.replace("data:image/jpeg;base64,", "");

            let skinPath = (nsfwStatus === "approved" ? SKIN_STATIC : PENDING_SKIN_STATIC) 
                        + "/" + skinDoc.skinID + ".jpg";
            fs.writeFileSync(skinPath, imageBase64Data, "base64");
            
            let messageID = await this.bot.pendSkinReview(req.vanisUser.discordID, result, skinPath, "SPOILER_" + req.params.skinName + ".jpg");
            if (messageID) {
                skinDoc.messageID = messageID;
                await skinDoc.save();
            }

            res.json({
                id: skinDoc.skinID,
                skinName: skinDoc.skinName,
                status: skinDoc.status
            });

        } catch (e) {
            this.logger.warn(`Error occured while running NSFW detection`);
            this.logger.onError(e);

            res.sendStatus(500);
        }

    },
    method: "post",
    path: "/skins/:skinName",
    pre: [expressForms.text({ limit: "2mb", type: "*/*" })]
};

module.exports = endpoint;