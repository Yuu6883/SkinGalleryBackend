/** @type {AppConfig} */
const config = {
    env: "production",

    dbPath: "mongodb://localhost:27017/vanis-skins",

    webLocation: 3000,
    webDomain: null,

    discordAppID: "614712004644438047",
    discordAppSecret: "xjUwM_wkafEYK_hGKwaikww3W9p0zid4",
    discordAppRedirect: "https://skins.vanis.io/api/login/callback",
    discordBotToken: "NjE0NzEyMDA0NjQ0NDM4MDQ3.XWDgUw.BisdBGMA-KJxUpXlRr03pUrgmBs",

    nsfwLowThreshold: .1,
    nsfwHighThreshold: .9,
    skinApprovedChannelID: "626201875129303060",
    skinPendingChannelID:  "620795314496077824",
    skinRejectedChannelID: "626201904417996800",
    skinDeletedChannelID:  "626650381719699459",
    notifChannelID: "602980591390162983",
    skinLimit: 10,
    approveEmoji: "✅",
    rejectEmoji: "❎",
    reviewInterval: 5000,
    approveThreshold: 3,
    rejectThreshold: 3,
    // pro hardcode
    admins: ["214154668044058624", "297567645044310017"],
    prefix: "!"
};

if (config.env === "development") config.discordAppRedirect = "http://localhost/api/login/callback";

module.exports = config;
