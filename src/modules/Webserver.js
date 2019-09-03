const fs = require("fs");
const path = require("path");

const { WEB_STATIC_SOURCE } = require("../constant");

const express = require("express");
const expressCookies = require("cookie-parser");
const expressForms = require("body-parser");
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

        // Required parser middleware
        apiRouter.use(expressCookies());
        apiRouter.use(expressForms.json());

        // Prevent cross-origin requests
        apiRouter.use((req, res, next) => {
            const origin = req.get("origin");

            if (this.webDomainRegex && !this.webDomainRegex.test(origin))
                return void res.sendStatus(403);

            res.header("Access-Control-Allow-Origin", origin || "*");
            res.header("Access-Control-Allow-Credentials", "true");
            next();
        });

        // Register endpoints
        fs.readdirSync(path.resolve(__dirname, "../api")).forEach(file => {
            /** @type {APIEndpointHandler} */
            const endpoint = require(path.resolve(__dirname, "../api", file));
            if (!endpoint.handler || !endpoint.method || !endpoint.path)
                return void this.logger.warn(`Ignoring endpoint file ${file}: module export not properly defined`);
            apiRouter[endpoint.method](endpoint.path, endpoint.handler.bind(this.app));

            this.logger.inform(`Registering route ${endpoint.method.toUpperCase()} /api${endpoint.path}`);
        });

        // Redirect lurkers
        apiRouter.use((req, res) => {
            this.logger.onAccess(`Redirecting lurker from ${req.originalUrl}`);
            res.redirect("/");
        });

        return apiRouter;
    }

    async init() {
        const app = express();
        app.disable("x-powered-by");
        app.use(expressLogger(this.logger));
        app.use("/", express.static(WEB_STATIC_SOURCE));
        app.use("/api", this.generateAPIRouter());

        this.logger.debug("Webserver opening @", this.config.webLocation);
        return new Promise((res, rej) => {
            this.webserver = app.listen(this.config.webLocation, err => {
                if (err) return void rej(err);
                this.logger.inform("Webserver open");
                res();
            });
        });
    }
    async stop() {
        return new Promise((res, rej) => {
            this.webserver.close(err => {
                if (err) return void rej(err);
                this.logger.inform("Webserver closed");
                res();
            });
            this.webserver = null;
        });
    }
}

module.exports = Webserver;

const App = require("../app");
