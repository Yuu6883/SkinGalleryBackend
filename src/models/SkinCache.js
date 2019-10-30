const SKIN_ID_BYTES = 6;
const SKIN_NAME_BYTES = 32;
const SKIN_TAG_BYTES = 8
const SKIN_TAG_LENGTH = 64;
const FAV_BYTES = 2;
const TIME_BYTES = 4;
const DISCORD_ID_BYTES = 8;

const BYTES_PER_SKIN = SKIN_ID_BYTES + SKIN_NAME_BYTES + SKIN_TAG_BYTES +
    FAV_BYTES + TIME_BYTES + DISCORD_ID_BYTES;

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

    get sortByFav()  { return this.cache.sortByFav  }
    get sortByName() { return this.cache.sortByName }
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

            this.writeUTF16(buffer, skin.skinName, 
                offset, SKIN_NAME_BYTES / 2);
            offset += SKIN_NAME_BYTES;

            this.writeTags(buffer, skin.tags,  offset);
            offset += SKIN_TAG_BYTES;

            buffer.writeUInt16BE(skin.favorites, offset);
            offset += FAV_BYTES;

            buffer.writeUInt32BE(skin.createdAt, offset);
            offset += TIME_BYTES;

            let ownerID = BigInt(skin.ownerID);
            let view = new DataView(buffer.buffer, offset);
            view.setBigUint64(0, ownerID);
            
            offset += DISCORD_ID_BYTES;
        }
    }

    /** 
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
                                                    
            let skinName = buffer.toString("utf16le", index,
                                                    index +  SKIN_NAME_BYTES)
                                 .replace(/\u0000/g, "");
            index += SKIN_NAME_BYTES;

            let tags = this.readTags(buffer, index);
            index += SKIN_TAG_BYTES;

            let favorites = buffer.readUInt16BE(index);
            index += FAV_BYTES;

            let createdAt = buffer.readUInt32BE(index);
            index += TIME_BYTES;

            let ownerID = new DataView(buffer.buffer, index)
                .getBigUint64();
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
        let number1 = buffer.readUInt32BE(offset);
        let number2 = buffer.readUInt32BE(offset + 4);
        // Read first 32 bits
        for (let i = 0; i < 32; i++)
            if (number1.toString(2)[i] == 1)
                tags.push(this.app.config.tags[i]);

        // Read second 32 bits
        for (let i = 0; i < 32; i++)
            if (number1.toString(2)[i] == 1)
                tags.push(this.app.config.tags[32 + i]);

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
            buffer.writeUInt8(string.charCodeAt(i) || 0, offset + i);
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
            let tag = this.app.config.tags[index];

            // tag && console.log(`Checking tag: ${tag} at index ${index}`);

            if (tag && tags.includes(tag)) {
                let shift = ~~(SKIN_TAG_LENGTH / 2 - index - 1);
                let bit = (1 << shift) >>> 0;
                // console.log(`Bit OR with unsigned 1 << ${shift} (${bit.toString(2)}) because tag ${tag}`);
                unsigned[0] |= bit;
                // console.log(`Current value: ${unsigned[0].toString(2)}`);
            }
        }
        buffer.writeUInt32BE(unsigned[0], offset);
        // console.log(`Writing [${unsigned[0].toString(2)}] at ${offset}`);
        
        // Second half, 32 bits
        unsigned[0] = 0;
        for (let index = 0; index < SKIN_TAG_LENGTH / 2; index++) {
            let tag = this.app.config.tags[SKIN_TAG_LENGTH / 2 + index];
            if (tag && tags.includes(tag))
                unsigned[0] |= 1 << (SKIN_TAG_LENGTH / 2 - index - 1);
        }
        buffer.writeUInt32BE(unsigned[0], offset + 4);
        // console.log(`Writing [${unsigned[0].toString(2)}] at ${offset + 4}`);
    }

    rellocCache(length) {
        this.cache.sortByFav  = Buffer.allocUnsafe(length);
        this.cache.sortByName = Buffer.allocUnsafe(length);
        this.cache.sortByTime = Buffer.allocUnsafe(length);
    }
}

module.exports = SkinCache;