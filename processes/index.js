const pm2 = require("pm2");

pm2.connect(async err => {
    if (err)
        return console.error(err);

    await new Promise(resolve => pm2.start({
        script: `${__dirname}/bot.js`,
        name: "BOT",
        env: { NODE_ENV: process.env.NODE_ENV },
        restart_delay: 10000,
        max_memory_restart: "75M"
    }, err => {
        if (err)
            console.log("Failed to start BOT: ", err);
        resolve();
    }));

    await new Promise(resolve => pm2.start({
        script: `${__dirname}/nsfw.js`,
        name: "NSFW",
        env: { NODE_ENV: process.env.NODE_ENV },
        restart_delay: 10000,
        max_memory_restart: "400M"
    }, err => {
        if (err)
            console.log("Failed to start NSFW: ", err);
        resolve();
    }));

    await new Promise(resolve => pm2.start({
        script: `${__dirname}/server.js`,
        name: "SERVER",
        restart_delay: 10000,
        env: { NODE_ENV: process.env.NODE_ENV },
        exec_mode: "cluster",
        instances: Math.min((require("os").cpus().length - 1) || 1, 4),
        max_memory_restart: "65M"
    }, err => {
        if (err)
            console.log("Failed to start SERVER: ", err);
        resolve();
    }));

    pm2.disconnect();
    console.log("Done.");
});