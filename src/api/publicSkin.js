const { hasPermission } = require("../constant");

/** @type {APIEndpointHandler} */
const endpoint = {
    async handler(req, res) {
        if (!hasPermission("VIEW_PUBLIC_SKIN", req.permissions))
            return void res.sendStatus(403);

        if (!this.skins.publicCache.cacheLength)
            return void res.send(Buffer.alloc(0));

        /** @type {String} */
        let sort = req.query.sort;
        let reverse = sort[0] == "-";
        /** @type {Buffer} */
        let buffer;

        let page = ~~req.query.page;
        let maxPage = ~~((this.skins.publicCache.cacheLength - 1) /
                          this.config.publicPageLimit);
        let total = this.skins.publicCache.cacheLength;

        switch (sort) {

            case "time":
            case "-time":
                buffer = this.skins.publicCache.sortByTime;
                break;

            case "-fav":
                buffer = this.skins.publicCache.sortByFav;
                maxPage = ~~((this.skins.publicCache.favLength - 1) /
                              this.config.publicPageLimit);
                total = this.skins.publicCache.favLength;
                break;

            // case "name":
            // case "-name":
            //     buffer = this.skins.publicCache.sortByName;
            //     break;

            default:
                return void res.sendStatus(400);
        }

        page = page > 0  ? (page > maxPage ? maxPage : page) : 0;

        let BYTES_PER_SKIN = this.skins.publicCache.BYTES_PER_SKIN;

        let start = page * this.config.publicPageLimit * BYTES_PER_SKIN;
        let end = Math.min((start + this.config.publicPageLimit * BYTES_PER_SKIN), buffer.byteLength);
        res.header("x-skin-total", total);

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
