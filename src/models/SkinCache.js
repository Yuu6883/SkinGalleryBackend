const SKIN_ID_BYTES = 6;
const SKIN_NAME_BYTES = 16;
const SKIN_TAG_BYTES = 8
const SKIN_TAG_LENGTH = 64;
const FAV_BYTES = 2;
const TIME_BYTES = 4;
const DISCORD_ID_BYTES = 8;

const BYTES_PER_SKIN = SKIN_ID_BYTES + SKIN_NAME_BYTES + SKIN_TAG_BYTES +
    SKIN_TAG_BYTES + FAV_BYTES + TIME_BYTES + DISCORD_ID_BYTES;

class SkinCache {

    /**
     * @param {import("../App")} app
     */
    constructor(app) {
        this.app = app;
        this.cacheLength = 0;
        
        /** @type {{sortByFav:Buffer,sortByName:Buffer,sortByTime:Buffer}} */
        this.cache = {};
    }

    /** @param {SkinDocument[]} skinDocs */
    createCache(skinDocs) {

        // Reallocate buffer if size changed
        if (this.cacheLength != skinDocs.length) 
            this.rellocCache(BYTES_PER_SKIN * skinDocs.length);
        this.cacheLength = skinDocs.length;
        
        this.writeToCache(this.cache.sortByFav, skinDocs.sort((a, b) =>
            b.favorites - a.favorites
        ));

        this.writeToCache(this.cache.sortByTime, skinDocs.sort((a, b) =>
            b.createdAt - a.createdAt
        ));

        this.writeToCache(this.cache.sortByName, skinDocs.sort((a, b) =>
            b.skinName.localeCompare(a.skinName)
        ));
    }

    /** 
     * @param {Buffer} buffer
     * @param {SkinDocument[]} skinDocs 
     */
    writeToCache(buffer, skinDocs) {
        console.assert(buffer.byteLength == BYTES_PER_SKIN * skinDocs.length);
        let offset = 0;
        let skin;
        for (let i in skinDocs) {
            offset = ~~i * BYTES_PER_SKIN;
            skin = skinDocs[i];
            this.writeUTF8(buffer, skin.skinID, offset += 6, 6);
            this.writeUTF16(buffer, skin.skinName, offset += 16, 16);
            this.writeTags(buffer, skin.tags, offset += 8);
        }
    }

    /**
     * @param {Buffer} buffer 
     * @param {String} string
     * @param {number} offset 
     * @param {number} maxlength 
     */
    writeUTF8(buffer, string, offset, maxlength) {
        for (let i = 0; i < maxlength; i++)
            buffer.writeUInt8(string.charCodeAt(i) || 0, offset + i);
    }

    /**
     * @param {Buffer} buffer 
     * @param {String} string
     * @param {number} offset 
     * @param {number} maxlength 
     */
    writeUTF16(buffer, string, offset, maxlength) {
        for (let i = 0; i < maxlength; i+=2)
            buffer.writeUInt8(string.charCodeAt(i) || 0, offset + i);
    }

    /**
     * @param {Buffer} buffer 
     * @param {String[]} tags 
     * @param {Number} offset 
     */
    writeTags(buffer, tags, offset) {
        // First half, 32 bits
        let number = 0;
        for (let index = 0; index < SKIN_TAG_LENGTH / 2; index++) {
            let tag = this.app.config.tags[index];
            if (tag && tags.includes(tag))
                number |= 1 << index;
        }
        buffer.writeUInt32BE(number, offset);
        
        // Second half, 32 bits
        number = 0;
        for (let index = 0; index < SKIN_TAG_LENGTH / 2; index++) {
            let tag = this.app.config.tags[index];
            if (tag && tags.includes(tag))
                number |= 1 << index;
        }
        buffer.writeUInt32BE(number, offset + 4);
    }

    rellocCache(length) {
        this.cache.sortByFav  = Buffer.allocUnsafe(length);
        this.cache.sortByName = Buffer.allocUnsafe(length);
        this.cache.sortByTime = Buffer.allocUnsafe(length);
    }
}

module.exports = SkinCache;