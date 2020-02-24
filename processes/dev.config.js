module.exports = {
    apps: [{
        name: "BOT",
        script: `./processes/bot.js`,
        restart_delay: 2500,
        max_memory_restart: "1000M",
        env: { "NODE_ENV": "development" },
        kill_timeout : 2500,
        wait_ready: true
    }, {
        name: "SERVER",
        script: "./processes/server.js",
        restart_delay: 2500,
        max_memory_restart: "2000M",
        exec_mode: "cluster",
        instances: 1,
        env: { "NODE_ENV": "development" },
        kill_timeout : 2500
    }]
}