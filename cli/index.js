process.once("unhandledRejection", err => { throw err; });

const readline = require("readline");

const App = require("../src/app");
/** @type {AppConfig} */
const config = require("./config.js");
const app = new App(config);

require("./log-handler")(app);

app.init().then(() => {
    const repl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        removeHistoryDuplicates: true,
        prompt: "@ "
    });
    repl.on("line", async input => {
        app.logger.printFile(`@ ${input}`);
        try {
            let x = eval(input);
            while (x instanceof Promise) {
                app.logger.print("awaiting promise...");
                x = await x;
            }
            app.logger.print(x);
        } catch (e) {
            app.logger.warn(e);
        }
        repl.prompt(false);
    });
    repl.once("SIGINT", () => {
        repl.close();
        app.logger.inform("SIGINT on REPL");
        app.stop();
    });
    repl.prompt(false);
});
