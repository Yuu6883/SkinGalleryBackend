const fs = require("fs");
const path = require("path");

const express = require("express");
const expressCookies = require("cookie-parser");
const expressLogger = require("./ExpressLogger");

class Webserver {
    /**
     * @param {App} app
     */
    constructor(app) {
        this.app = app;
        /** @type {import("http").Server} */
        this.webserver = null;
        this.webDomainRegex =
            app.config.webDomain
            ? new RegExp(`^https?://${app.config.webDomain}`)
            : null;
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    generateAPIRouter() {
        const apiRouter = express.Router();
        const apiEndpointRouter = express.Router();

        // Cookie parser
        apiRouter.use(expressCookies());

        // Prevent cross-origin requests
        apiRouter.use((req, res, next) => {
            const origin = req.get("origin");

            if (this.webDomainRegex && !this.webDomainRegex.test(origin))
                return status(403)();

            res.header("Access-Control-Allow-Origin", origin || "*");
            res.header("Access-Control-Allow-Credentials", "true");
            next();
        });

        // Register endpoints
        fs.readdirSync(path.resolve(__dirname, "../api")).forEach(file => {
            /** @type {APIEndpointHandler} */
            const endpoint = require(path.resolve(__dirname, "../api", file));
            apiEndpointRouter[endpoint.method](endpoint.path, endpoint.handler.bind(this));
        });

        apiRouter.use("/", apiEndpointRouter);

        // Redirect lurkers
        apiRouter.use((req, res, next) => {
            res.redirect("/");
        });

        return apiRouter;
    }

    async init() {
        const app = express();
        // Logger
        app.use(expressLogger(this.logger));
        app.use("/", express.static("../web"));
        app.use("/", this.generateAPIRouter());

        this.logger.inform("webserver opening @", this.config.webLocation);
        return new Promise((res, rej) => {
            this.webserver = app.listen(this.config.webLocation, err => {
                if (err) return void rej(err);
                this.logger.inform("webserver open");
                res();
            });
        });
    }
    async stop() {
        return new Promise((res, rej) => {
            this.webserver.close(err => {
                if (err) return void rej(err);
                this.logger.inform("webserver closed");
                res();
            });
            this.webserver = null;
        });
    }
}

module.exports = Webserver;

const App = require("../app");
