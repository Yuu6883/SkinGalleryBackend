const config = require("../cli/config");
const SkinsBot = require("./modules/DiscordBot");

new SkinsBot({}, config).init();