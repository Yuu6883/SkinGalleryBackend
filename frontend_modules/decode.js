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
} = require("../src/common/constants");

/** @param {ArrayBuffer} buffer */
const readUTF8  = buffer => String.fromCharCode(...new Uint8Array(buffer));
/** @param {ArrayBuffer} buffer */
const readUTF16 = buffer => String.fromCharCode(...new Uint16Array(buffer));
/** @param {ArrayBuffer} buffer */
const readTags = buffer => {
    let tags = [];
    let [num1, num2] = new Uint32Array(buffer);
    let str = num1.toString(2).padStart(32, "0") + num2.toString(2).padEnd(32, "0");
    for (let i = 0; i < SKIN_TAG_LENGTH; i++)
        str[i] == 1 && tags.push(TAGS[i]);
    return tags;
}

/** @param {ArrayBuffer} buffer */
module.exports = buffer => {
    let view = new DataView(buffer);
    console.assert(!(buffer.byteLength % BYTES_PER_SKIN));

    let result = [];
    let index = 0;

    while (index < buffer.byteLength) {
        let skinID = readUTF8(buffer.slice(index, index + SKIN_ID_BYTES));
        index += SKIN_ID_BYTES;

        let skinName = readUTF8(buffer.slice(index, index + SKIN_NAME_BYTES))
                            .replace(/\u0000/g, "");
        index += SKIN_NAME_BYTES;

        let tags = readTags(buffer.slice(index, index + SKIN_TAG_BYTES));
        index += SKIN_TAG_BYTES;

        let favorites = view.getUint16(index);
        index += FAV_BYTES;

        let createdAt = view.getUint32(index); // new Date(TIME_0 + (view.getUint32(index) * 1000));
        index += TIME_BYTES;

        let ownerID = view.getBigUint64(index).toString();
        index += DISCORD_ID_BYTES;

        result.push({
            skinID,
            ownerID,
            skinName,
            tags,
            favorites,
            createdAt
        });
    }

    return result;
}