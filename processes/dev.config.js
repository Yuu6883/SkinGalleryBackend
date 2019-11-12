module.exports = {
    apps: [{
        name: "BOT",
        script: `./processes/bot.js`,
        restart_delay: 2500,
        max_memory_restart: "200M",
        env: { "NODE_ENV": "development" },
        kill_timeout : 2500,
        wait_ready: true
    }, {
        name: "NSFW",
        script: "./processes/nsfw.js",
        restart_delay: 25000,
        max_memory_restart: "400M",
        env: { "NODE_ENV": "development" }
    }, {
        name: "SERVER",
        script: "./processes/server.js",
        restart_delay: 2500,
        max_memory_restart: "100M",
        exec_mode: "cluster",
        instances: 1,
        env: { "NODE_ENV": "development" },
        kill_timeout : 2500
    }]
}