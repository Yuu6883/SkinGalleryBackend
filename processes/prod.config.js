module.exports = {
    apps: [{
        name: "BOT",
        script: `./processes/bot.js`,
        restart_delay: 2500,
        max_memory_restart: "120M",
        env: { "NODE_ENV": "production" },
        kill_timeout : 2500,
        wait_ready: true
    }, {
        name: "NSFW",
        script: "./processes/nsfw.js",
        restart_delay: 25000,
        max_memory_restart: "400M",
        env: { "NODE_ENV": "production" },
    }, {
        name: "SERVER",
        script: "./processes/server.js",
        restart_delay: 2500,
        max_memory_restart: "200M",
        exec_mode: "cluster",
        instances: Math.min((require("os").cpus().length - 1) || 1, 4),
        env: { "NODE_ENV": "production" },
        kill_timeout : 2500
    }]
}