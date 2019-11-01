const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("VIEW_PUBLIC_SKIN", req.vanisPermissions))
            return void res.sendStatus(403);

        let page = ~~req.query.page;
        let maxPage = ~~((this.skins.publicCache.cacheLength - 1) / 
                          this.config.publicPageLimit);

        page = page > 0  ? (page > maxPage ? maxPage : page) : 0;

        /** @type {String} */
        let sort = req.query.sort;
        let reverse = sort[0] == "-";
        /** @type {Buffer} */
        let buffer;

        switch (sort) {
            case "fav":
            case "-fav":
                buffer = this.skins.publicCache.sortByFav;
                break;

            case "name":
            case "-name":
                buffer = this.skins.publicCache.sortByName;
                break;

            default:
                buffer = this.skins.publicCache.sortByTime;
        }

        let start = page * this.config.publicPageLimit;
        let end = Math.max(start + this.config.publicPageLimit, buffer.byteLength);
        if (reverse) {
            res.send(buffer.slice(start, end));
        } else {
            res.send(buffer.slice(buffer.byteLength - end, buffer.byteLength - start));
        }
    },
    method: "get",
    path:   "/public"
}

module.exports = endpoint;