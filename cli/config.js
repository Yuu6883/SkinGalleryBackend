/** @type {AppConfig} */
const config = {
    env: process.platform == "win32" ? "development" : "production",

    dbPath: "mongodb://localhost:27017/vanis-skins",

    webLocation: 3000,
    webDomain: null,

    discordAppID:       "614712004644438047",
    discordAppSecret:   "xjUwM_wkafEYK_hGKwaikww3W9p0zid4",
    discordAppRedirect: "https://skins.vanis.io/api/login/callback",
    discordBotToken:    "NjE0NzEyMDA0NjQ0NDM4MDQ3.XWDgUw.BisdBGMA-KJxUpXlRr03pUrgmBs",

    publicUpdateInterval: 5 * 60 * 1000, // 5 minutes
    publicPageLimit: 20,

    nsfwLowThreshold: .1,
    nsfwHighThreshold: 1,
    skinApprovedChannelID: "626201875129303060",
    skinPendingChannelID:  "620795314496077824",
    skinRejectedChannelID: "626201904417996800",
    skinDeletedChannelID:  "626650381719699459",
    notifChannelID:        "602980591390162983",
    skinLimit: 20,
    approveEmoji: "✅",
    rejectEmoji:  "❎",
    reviewInterval: 5000,
    approveThreshold: 3,
    rejectThreshold:  3,

    tags: ["other"],
    // pro hardcode
    admins: ["214154668044058624", "297567645044310017"],
    prefix: "!"
};

if (config.env === "development") {
    config.prefix = "?";
    config.notifChannelID     = "603808828487761941";
    config.discordAppID       = "607173234688786432";
    config.discordAppSecret   = "NrITYkjlxOJ91LObpEZ8kDIWpaTSRvKy";
    config.discordAppRedirect = "http://localhost/api/login/callback";
    config.discordBotToken    = "NjA3MTczMjM0Njg4Nzg2NDMy.XbGFKg.sx3yMszTEc2C6CsgzJGd69tVMEA";
}

module.exports = config;
