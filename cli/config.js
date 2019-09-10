/** @type {AppConfig} */
module.exports = {
    env: "production",

    dbPath: "mongodb://localhost:27017/vanis-skins",

    webLocation: 80,
    webDomain: null,

    discordAppID: "614712004644438047",
    discordAppSecret: "xjUwM_wkafEYK_hGKwaikww3W9p0zid4",
    discordAppRedirect: "http://localhost/api/login/callback",
    discordBotToken: "NjE0NzEyMDA0NjQ0NDM4MDQ3.XWDgUw.BisdBGMA-KJxUpXlRr03pUrgmBs",

    nsfwLowThreshold: .2,
    nsfwHighThreshold: .7,
    skinReviewChannelID: "620795314496077824",
    approveEmoji: "✅",
    rejectEmoji: "❎",
    reviewInterval: 5000,
    approveThreshold: 2,
    rejectThreshold: 2,
    // pro hardcode
    admins: ["214154668044058624", "297567645044310017"]
};
