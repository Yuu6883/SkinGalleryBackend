const Runner = require("./runner");

Runner(true).then(app => {
    app.provision.createdRecently(app.config.admins[1]);
    process.exit(0);
});