const fs = require("fs");
const path = require("path");

const { WEB_STATIC_SOURCE, SKIN_STATIC, 
        VANIS_TOKEN_COOKIE, AUTH_LEVELS } = require("../constant");

const express = require("express");
const expressCookies = require("cookie-parser");
const expressForms = require("body-parser");
const nocache = require("nocache");
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

        // Try to authorize the Vanis side
        apiRouter.use(async (req, res, next) => {
            /** @type {string} */
            const vanisToken = req.cookies[VANIS_TOKEN_COOKIE];
            /** @type {UserDocument} */
            let vanisUser;

            if (this.app.provision.confirmVanisToken(vanisToken))
                vanisUser = req.vanisUser = await this.app.users.findAuthedVanis(vanisToken);
            if (vanisUser == null) {
                req.vanisPermissions = AUTH_LEVELS.NONE;
                res.clearCookie(VANIS_TOKEN_COOKIE);
            } else if (vanisUser.moderator)
                req.vanisPermissions = AUTH_LEVELS.MOD;
            else if (vanisUser.bannedUntil > new Date())
                req.vanisPermissions = AUTH_LEVELS.USER_BANNED;
            else
                req.vanisPermissions = AUTH_LEVELS.USER;
            next();
        });

        // Register endpoints
        fs.readdirSync(path.resolve(__dirname, "../api")).forEach(file => {
            /** @type {APIEndpointHandler} */
            const endpoint = require(path.resolve(__dirname, "../api", file));
            if (!endpoint.handler || !endpoint.method || !endpoint.path)
                return void this.logger.warn(`Ignoring endpoint file ${file}: module export not properly defined`);

            if (endpoint.pre && Array.isArray(endpoint.pre))
                apiRouter.use(endpoint.path, ...endpoint.pre);

            apiRouter[endpoint.method](endpoint.path, endpoint.handler.bind(this.app));

            this.logger.inform(`Registering route ${endpoint.method.toUpperCase()} ${endpoint.path}`);
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
        app.set("trust proxy", 1);
        app.use(expressLogger(this.logger));
        app.use(nocache())
        
        // Prevent cross-origin requests
        app.use((req, res, next) => {
            const origin = req.get("origin");

            if (this.webDomainRegex && !this.webDomainRegex.test(origin)) {
                this.logger.warn(`Blocked request from unknown origin: ${origin}`)
                return void res.sendStatus(403);
            }
            
            this.logger.onAccess(`Request Origin: ${origin || "*"}`);
            res.set("Access-Control-Allow-Origin", origin || "*");
            res.set("Access-Control-Allow-Credentials", "true");
            next();
        });
        
        app.use("/", this.generateAPIRouter());

        this.logger.debug("Webserver opening @", this.config.webLocation);
        return new Promise((res, rej) => {
            this.webserver = app.listen(this.config.webLocation, err => {
                if (err) return void rej(err);
                this.logger.inform("Webserver opened @", this.config.webLocation);
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
