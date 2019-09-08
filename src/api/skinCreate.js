const { hasPermission, PENDING_SKIN_STATIC, SKIN_STATIC } = require("../constant");
const fs = require("fs");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("UPLOAD_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        if (!this.provision.confirmSkinName(req.params.skinName))
            return void res.sendStatus(400);

        if (!this.provision.confirmJPEG(req.body))
            return void res.sendStatus(400);

        try {
            let result = await this.nsfwBot.classify(req.body);
            let nsfwStatus = this.nsfwBot.nsfwStatus(result);
            
            let skinDoc = await this.skins.create(req.vanisUser.discordID, req.params.skinName, nsfwStatus);
            let imageBase64Data = req.body.replace("data:image/jpeg;base64,", "");

            let path = nsfwStatus === "approved" ? SKIN_STATIC : PENDING_SKIN_STATIC;
            fs.writeFileSync(path + "/" + skinDoc.skinID + ".jpg", imageBase64Data, "base64");

            console.log(result);
            
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
    path: "/skins/:skinName"
};

module.exports = endpoint;
