const fs = require("fs");
const path = require("path");

const { GALLERY_TOKEN_COOKIE, AUTH_LEVELS } = require("../constant");

const express = require("express");
const expressCookies = require("cookie-parser");
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
        this.allowedOrigins = [`https://${this.app.config.webDomain}`, 
            `https://${this.app.config.gameDomain}`];

        this.blocked = {};
    }

    get config() { return this.app.config; }
    get logger() { return this.app.logger; }

    generateAPIRouter() {
        const apiRouter = express.Router();

        // Required parser middleware
        apiRouter.use(expressCookies());

        // Try to authorize
        apiRouter.use(async (req, res, next) => {
            /** @type {string} */
            const userToken = req.cookies[GALLERY_TOKEN_COOKIE];
            /** @type {UserDocument} */
            let user;

            if (this.app.provision.confirmToken(userToken))
                user = req.user = await this.app.users.findAuthed(userToken);
            if (user == null) {
                req.permissions = AUTH_LEVELS.NONE;
                req.userPermission = "NONE";
                res.clearCookie(GALLERY_TOKEN_COOKIE);
            } else if (user.moderator || this.config.admins.includes(user.discordID)) {
                req.permissions = AUTH_LEVELS.MOD;
                req.userPermission = "MOD";
            } else if (user.bannedUntil > new Date()) {
                req.permissions = AUTH_LEVELS.USER_BANNED;
                req.userPermission = "USER_BANNED";
            } else {
                req.permissions = AUTH_LEVELS.USER;
                req.userPermission = "USER";
            }
            this.logger.debug(`Request from token '${userToken}' identified as ${req.userPermission}`);

            if (req.permissions !== AUTH_LEVELS.MOD) {
                let origin = this.getOrigin(req);
                if (origin.startsWith(`https://${this.app.config.gameDomain}`)) {
                    this.logger.onAccess(`Non-mod perms did not allow request from client`);
                    return void res.sendStatus(403);
                }
            }

            next();
        });

        // Register endpoints
        fs.readdirSync(path.resolve(__dirname, "../api")).forEach(file => {
            /** @type {APIEndpointHandler} */
            const endpoint = require(path.resolve(__dirname, "../api", file));
            if (!endpoint.handler || !endpoint.method || !endpoint.path)
                return void this.logger.warn(`Ignoring endpoint file ${file}: module export not properly defined`);

            if (this.config.maintenance && endpoint.closeDuringMaintenance) {
                apiRouter[endpoint.method](endpoint.path, (_, res) =>
                    res.status(503).send("Server under maintenance"));
                return void this.logger.warn(`Endpoint ${file} not applied because server under maintenance`);
            }

            if (endpoint.pre && Array.isArray(endpoint.pre))
                apiRouter.use(endpoint.path, ...endpoint.pre);

            apiRouter[endpoint.method](endpoint.path, endpoint.handler.bind(this.app));

            // this.logger.debug(`Registering route ${endpoint.method.toUpperCase()} ${endpoint.path}`);
        });

        // Redirect lurkers
        apiRouter.use((req, res) => {
            this.logger.onAccess(`Redirecting lurker from ${req.originalUrl}`);
            res.redirect("/");
        });

        return apiRouter;
    }

    /** @param {import("express").Request} req */
    getOrigin(req) {
        let origin = req.get("origin") || req.get("referer") || ("https://" + req.get("host"));

        if (origin && origin[origin.length - 1] == "/")
            origin = origin.slice(0, -1);
        return origin;
    }

    /** @param {string} origin */
    checkOrigin(origin) {
        return !(this.allowedOrigins.length &&
            !/^http(s?):\/\/localhost/.test(origin) &&
            !/^https:\/\/(discord.com|discordapp.com)\/oauth2/.test(origin) &&
            !this.allowedOrigins.some(o => origin.startsWith(o)));
    }

    async init() {
        const app = express();
        app.disable("x-powered-by");
        app.set("trust proxy", 1);
        app.use(expressLogger(this.logger));
        app.use(nocache())

        // Prevent cross-origin requests
        app.use((req, res, next) => {
            let origin = this.getOrigin(req);

            if (!this.checkOrigin(origin)) {
                // this.logger.warn(`Blocked request from unknown origin: ${origin}`);
                if (this.blocked[origin]) this.blocked[origin]++;
                else this.blocked[origin] = 1;

                this.logger.onAccess(`Cross-origin request from ${origin} blocked`);
                return void res.sendStatus(403);
            }

            res.ip = req.get("CF-Connecting-IP") || req.socket.remoteAddress;

            res.set("Access-Control-Allow-Origin", origin || "*");
            res.set("Access-Control-Allow-Credentials", "true");
            next();
        });

        app.use("/", this.generateAPIRouter());

        this.logger.debug("Webserver opening @", this.config.webLocation);
        return new Promise((res, rej) => {
            this.webserver = app.listen(this.config.webLocation, err => {
                if (err) return void rej(err);
                this.logger.inform(`Webserver started`);
                res();
            });
        });
    }
    async stop() {
        return new Promise((res, rej) => {
            this.webserver.close(err => {
                if (err) return void rej(err);
                this.logger.inform(`Webserver closed`);
                res();
            });
            this.webserver = null;
        });
    }
}

module.exports = Webserver;

const App = require("../app");
