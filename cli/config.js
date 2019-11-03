/** @type {AppConfig} */
const config = {
    env: process.platform == "win32" ? "development" : "production",

    dbPath: "mongodb://localhost:27017/skins-gallery",

    webLocation: 3000,
    webDomain: "https://skins.gallery",

    discordAppID:       "614712004644438047",
    discordAppSecret:   "xjUwM_wkafEYK_hGKwaikww3W9p0zid4",
    discordAppRedirect: "https://skins.gallery/api/login/callback",
    discordBotToken:    "NjE0NzEyMDA0NjQ0NDM4MDQ3.XWDgUw.BisdBGMA-KJxUpXlRr03pUrgmBs",
    userinfoCacheTime: 30 * 60 * 1000, // 30 minutes

    publicUpdateInterval: 5 * 60 * 1000, // 5 minutes
    publicPageLimit: 20,
    cfToken: "o8ZJKfs_nhtI972QWv9DjD3tD_-Soztkn5eXZECL",
    cfZone: "24c6173ecb1c2449d9e010b6728a7078",

    skinApprovedChannelID: "626201875129303060",
    skinPendingChannelID:  "620795314496077824",
    skinRejectedChannelID: "626201904417996800",
    skinDeletedChannelID:  "626650381719699459",
    notifChannelID:        "602980591390162983",
    debugChannelID:        "638801977509150731",
    skinLimit: 20,
    approveEmoji: "✅",
    rejectEmoji:  "❎",
    reviewInterval: 5000,
    approveThreshold: 3,
    rejectThreshold:  3,

    // pro hardcode
    admins: ["214154668044058624", "297567645044310017"],
    prefix: "!"
};

if (config.env === "development" || process.env.NODE_ENV == "development") {
    config.prefix = "?";
    config.notifChannelID     = "603808828487761941";
    config.discordAppID       = "607173234688786432";
    config.discordAppSecret   = "NrITYkjlxOJ91LObpEZ8kDIWpaTSRvKy";
    config.discordAppRedirect = "https://skins.gallery/api/login/callback";
    config.discordBotToken    = "NjA3MTczMjM0Njg4Nzg2NDMy.XbGFKg.sx3yMszTEc2C6CsgzJGd69tVMEA";

    config.skinApprovedChannelID = config.skinDeletedChannelID = 
    config.skinPendingChannelID = config.skinRejectedChannelID = config.debugChannelID;
}

module.exports = config;
