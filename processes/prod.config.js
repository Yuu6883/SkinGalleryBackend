const config = require("../cli/config");

const apps = [{
    name: "BOT",
    script: `./processes/bot.js`,
    restart_delay: 2500,
    max_memory_restart: "1000M",
    env: { "NODE_ENV": "production" },
    kill_timeout : 2500,
    wait_ready: true,
    max_restarts: 10000
}, {
    name: "SERVER",
    script: "./processes/server.js",
    restart_delay: 2500,
    max_memory_restart: "2000M",
    exec_mode: "cluster",
    instances: Math.min((require("os").cpus().length - 1) || 1, 4),
    env: { "NODE_ENV": "production" },
    kill_timeout : 2500,
    wait_ready: true,
    max_restarts: 10000
}];

module.exports = { apps };