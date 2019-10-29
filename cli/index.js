process.once("unhandledRejection", err => app.logger.onError(err));

const readline = require("readline");

const App = require("../src/app");
/** @type {AppConfig} */
const config = require("./config.js");
const app = new App(config);

require("./log-handler")(app);

app.init().then(() => {

    process.once("SIGINT", async () => {
        await app.stop();
        process.exit(0);
    });

    // nope
    if (app.config.env === "production") return;

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
    repl.once("SIGINT", async () => {
        repl.close();
        app.logger.inform("SIGINT on REPL");
        await app.stop();

        process.exit(0);
    });

    repl.prompt(false);
});
