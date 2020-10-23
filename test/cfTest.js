const runner = require("./runner");

const PURGE_LIST =
[
        "fj8o1u",
        "36yxyq",
        "kffxtz",
        "nqkvup",
        "xtc11x",
        "2fyey5"
];

runner(true).then(async app => {
    app.cloudflare.purgeList.push(...PURGE_LIST.map(id => `https://${app.config.webDomain}/p/${id}`));
    while (app.cloudflare.purgeList.length) {
        await app.cloudflare.applyPurge();
    }
    process.emit("SIGINT");
});
