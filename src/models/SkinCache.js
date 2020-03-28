const {
    SKIN_ID_BYTES,
    SKIN_NAME_BYTES,
    SKIN_TAG_BYTES,
    SKIN_TAG_LENGTH,
    FAV_BYTES,
    TIME_BYTES,
    DISCORD_ID_BYTES,
    BYTES_PER_SKIN,
    TAGS,
    TIME_0
} = require("../common/constants");

class SkinCache {

    /**
     * @param {import("../App")} app
     */
    constructor(app) {
        this.app = app;

        /** @type {Number} */
        this.cacheLength = 0;
        /** @type {Number} */
        this.favLength = 0;
        
        /** @type {{sortByFav:Buffer,sortByName:Buffer,sortByTime:Buffer}} */
        this.cache = {};
        this.BYTES_PER_SKIN = BYTES_PER_SKIN;
        this.rellocCache('sortByFav', 0);
        this.rellocCache('sortByTime', 0);
    }

    /** @param {SkinDocument[]} skinDocs */
    createCache(skinDocs) {
        if (!skinDocs || !skinDocs.length) return;
        
        // Reallocate buffer if size changed
        if (this.cacheLength != skinDocs.length) 
            this.rellocCache("sortByTime", BYTES_PER_SKIN * skinDocs.length);
        this.cacheLength = skinDocs.length;

        let favSkinDocs = skinDocs
            .filter(v => v.favorites > 0)
            .sort((a, b) => b.favorites - a.favorites);

        if (this.favLength != favSkinDocs.length)
            this.rellocCache("sortByFav", BYTES_PER_SKIN * favSkinDocs.length);

        this.favLength = favSkinDocs.length;
        this.writeToCache(this.cache.sortByFav, favSkinDocs);

        this.writeToCache(this.cache.sortByTime, 
            skinDocs.sort((a, b) => b.createdAt - a.createdAt));

        // this.writeToCache(this.cache.sortByName, skinDocs.sort((a, b) =>
        //     b.skinName.localeCompare(a.skinName)
        // ));
    }

    get sortByFav()  { return this.cache.sortByFav  }
    // get sortByName() { return this.cache.sortByName }
    get sortByTime() { return this.cache.sortByTime }

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

            this.writeUTF8(buffer, skin.skinID, 
                offset, SKIN_ID_BYTES);
            offset += SKIN_ID_BYTES;

            this.writeUTF8(buffer, skin.skinName, 
                offset, SKIN_NAME_BYTES);
            offset += SKIN_NAME_BYTES;

            this.writeTags(buffer, skin.tags,  offset);
            offset += SKIN_TAG_BYTES;

            buffer.writeUInt16BE(skin.favorites, offset);
            offset += FAV_BYTES;

            buffer.writeUInt32BE(skin.createdAt, offset);
            offset += TIME_BYTES;
            
            let ownerID = BigInt(skin.ownerID);

            buffer.writeBigInt64BE(ownerID, offset);
            offset += DISCORD_ID_BYTES;
        }
    }

    /** 
     * @description Template used for parsing in tests, not used by client
     * @param {Buffer} buffer
     */
    readCache(buffer) {
        console.assert(!(buffer.byteLength % BYTES_PER_SKIN), 
            `Buffer length should be a multiple of BYTES_PER_SKIN(${BYTES_PER_SKIN})`);

        let result = [];
        let index = 0;

        while (index < buffer.byteLength) {
            let skinID   = buffer.toString("utf8",  index,
                                                    index +  SKIN_ID_BYTES);
            index += SKIN_ID_BYTES;
                                                    
            let skinName = buffer.toString("utf8", index,
                                                   index +  SKIN_NAME_BYTES)
                                 .replace(/\u0000/g, "");
            index += SKIN_NAME_BYTES;

            let tags = this.readTags(buffer, index);
            index += SKIN_TAG_BYTES;

            let favorites = buffer.readUInt16BE(index);
            index += FAV_BYTES;

            let createdAt = buffer.readUInt32BE(index);
            index += TIME_BYTES;

            let ownerID = buffer.readBigUInt64BE(index);
            index += DISCORD_ID_BYTES;

            result.push({
                skinID,
                ownerID: ownerID.toString(),
                skinName,
                tags,
                favorites,
                createdAt
            });
        }

        return result;
    }

    /**
     * @param {Buffer} buffer 
     * @param {Number} offset
     */
    readTags(buffer, offset) { 
        let tags = [];
        let number1 = buffer.readUInt32LE(offset);
        let number2 = buffer.readUInt32LE(offset + 4);
        // Read first 32 bits
        for (let i = 0; i < 32; i++)
            if ((number1 >>> (SKIN_TAG_LENGTH / 2 - i - 1)) & 1)
                tags.push(TAGS[i]);

        // Read second 32 bits
        for (let i = 0; i < 32; i++)
            if ((number2 >>> (SKIN_TAG_LENGTH / 2 - i - 1)) & 1)
                tags.push(TAGS[32 + i]);

        return tags.filter(t => t);
    }

    /**
     * @param {Buffer} buffer 
     * @param {String} string
     * @param {number} offset 
     * @param {number} maxlength 
     */
    writeUTF8(buffer, string, offset, maxlength) {
        for (let i = 0; i < maxlength; i++)
            buffer.writeUInt8(Math.min(string.charCodeAt(i) || 0, 255), offset + i);
    }

    /**
     * @param {Buffer} buffer 
     * @param {String} string
     * @param {number} offset 
     * @param {number} maxlength 
     */
    writeUTF16(buffer, string, offset, maxlength) {
        for (let i = 0; i < maxlength; i++)
            buffer.writeUInt16LE(string.charCodeAt(i) || 0, offset + 2 * i);
        // console.log(buffer.slice(offset, offset + maxlength));
    }

    /**
     * @param {Buffer} buffer 
     * @param {String[]} tags 
     * @param {Number} offset 
     */
    writeTags(buffer, tags, offset) {
        // First half, 32 bits
        let unsigned = new Uint32Array(1);
        
        for (let index = 0; index < SKIN_TAG_LENGTH / 2; index++) {
            let tag = TAGS[index];

            // tag && console.log(`Checking tag: ${tag} at index ${index}`);

            if (tag && tags.includes(tag)) {
                let shift = ~~(SKIN_TAG_LENGTH / 2 - index - 1);
                let bit = (1 << shift) >>> 0;
                // console.log(`Bit OR with unsigned 1 << ${shift} (${bit.toString(2)}) because tag ${tag}`);
                unsigned[0] |= bit;
                // console.log(`Current value: ${unsigned[0].toString(2)}`);
            }
        }
        buffer.writeUInt32LE(unsigned[0], offset);
        // console.log(`Writing [${unsigned[0].toString(2).padStart(32, "0")}] at ${offset}`);
        
        // Second half, 32 bits
        unsigned[0] = 0;
        for (let index = 0; index < SKIN_TAG_LENGTH / 2; index++) {
            let tag = TAGS[SKIN_TAG_LENGTH / 2 + index];
            if (tag && tags.includes(tag))
                unsigned[0] |= 1 << (SKIN_TAG_LENGTH / 2 - index - 1);
        }
        buffer.writeUInt32LE(unsigned[0], offset + 4);
        // console.log(`Writing [${unsigned[0].toString(2).padStart(32, "0")}] at ${offset + 4}`);
    }

    /** 
     * @param {'sortByFav'|'sortByName'|'sortByTime'} name
     * @param {Number} number */
    rellocCache(name, length) {
        this.cache[name]  = Buffer.allocUnsafe(length);
    }
}

SkinCache.TIME_0 = TIME_0;

module.exports = SkinCache;