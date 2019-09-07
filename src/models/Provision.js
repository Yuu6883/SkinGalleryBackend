const skinIdChars = "abcdefghijklmnopqrstuvwxyz1234567890";
const vanisTokenChars = "abcdef1234567890";

/**
 * @param {string} chars
 * @param {number} length
 */
function generateToken(chars, length) {
    return new Array(length).fill(null).map(v => chars[~~(Math.random() * chars.length)]).join("");
}
/**
 * @param {string} chars
 * @param {number} length
 */
function confirmToken(str, chars, length) {
    return new RegExp(`[${chars}]{${length},${length}}`).test(str);
}

class Provision {
    constructor() { }

    generateSkinId() {
        return generateToken(skinIdChars, 6);
    }
    generateVanisToken() {
        return generateToken(vanisTokenChars, 32);
    }

    /**
     * @param {string} str
     */
    confirmSkinId(str) {
        return confirmToken(str, skinIdChars, 6);
    }
    /**
     * @param {string} str
     */
    confirmSkinSource(str) {
        return /^https?:\/\/i\.imgur\.com\/[\w]{7,7}\.(png|jpg)$/.test(str);
    }

    /**
     * @param {string} str
     */
    confirmVanisToken(str) {
        return confirmToken(str, vanisTokenChars, 32);
    }
    /**
     * @param {string} str
     */
    confirmVanisAuthed(str) {

    }
}

module.exports = Provision;
