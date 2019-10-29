const fetch = require("node-fetch");
const CF_PURGE_LIMIT = 30;
const DOMAIN = "https://skins.vanis.io";

class Cloudflare {

    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
        /** @type {String[]} */
        this.purgeList = [];
    }

    get logger() { return this.app.logger }

    /** @param {String} url */
    async purgeCache(url) {
        if (this.app.config.env !== "production") return;
        
        if (!url.startsWith(DOMAIN)) {
            this.logger.warn(`Trying to purge none-related url: ${url}`);
            return;
        }
        this.logger.debug(`Adding ${url.replace(DOMAIN, "")} to purge list`);

        this.purgeList.push(url);
        await this.applyPurge();
    }

    async applyPurge() {
        let purging = this.purgeList.slice(0, CF_PURGE_LIMIT);

        if (!purging.length) return;

        let res = await fetch("https://api.cloudflare.com/client/v4/zones/b61eca71559601bb216ff247629c2b1a/purge_cache", {
            method: "POST",
            body: JSON.stringify({ files: purging }),
            headers: {
                "Authorization": `Bearer ${this.app.config.cfToken}`,
                "Content-Type": "application/json"
            }
        }).catch(_ => ({ json: async() => {}}));

        let json = await res.json().catch(() => {});

        if (!json.success) {
            this.logger.onError("Failed to purge CF cache", json.errors);
        } else {
            this.purgeList = this.purgeList.slice(CF_PURGE_LIMIT);
            this.logger.debug(`Purged URL's: ${purging.map(p => p.replace(DOMAIN, "")).join(", ")}`);
        }
    }
}

module.exports = Cloudflare;