const fetch = require("node-fetch");
const CF_PURGE_LIMIT = 30;

class Cloudflare {

    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
        this.warnings = 0;
        /** @type {String[]} */
        this.purgeList = [];
        this.zone = app.config.cfZone;
        this.domain = app.config.webDomain;
    }

    get logger() { return this.app.logger }

    /** @param {String[]} urls */
    async purgeCache(...urls) {
        
        if (this.app.config.env != "production") {
            this.logger.warn("Trying to purge cloudflare cache in dev mode, returning");
            return;
        }
        
        urls = urls.filter(url => {
            if (!url.startsWith(this.domain)) {
                this.logger.warn(`Trying to purge none-related url: ${urls.join(", ")}`);
                return false;
            }
            return true;
        });

        if (!urls.length) return;

        this.logger.debug(`Adding ${urls.map(u => u.replace(this.domain, "")).join(", ")} to purge list`);

        this.purgeList.push(...urls);
        await this.applyPurge();
    }

    async applyPurge() {
        let purging = this.purgeList.slice(0, CF_PURGE_LIMIT);

        if (!purging.length) return;

        let res = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.zone}/purge_cache`, {
            method: "POST",
            body: JSON.stringify({ files: purging }),
            headers: {
                "Authorization": `Bearer ${this.app.config.cfToken}`,
                "Content-Type": "application/json"
            }
        }).catch(_ => ({ json: async() => {}}));

        let json = await res.json().catch(() => {});

        if (!json.success) {
            this.logger.warn("Failed to purge CF cache", json.errors);
        } else {
            this.purgeList = this.purgeList.slice(purging.length);
            this.logger.debug(`Purged URL(s): ${purging.map(p => p.replace(this.domain, "")).join(", ")}`);
        }
    }
}

module.exports = Cloudflare;