const skinIdChars = "abcdefghijklmnopqrstuvwxyz1234567890";
const vanisTokenChars = "abcdef1234567890";

/**
 * @param {string} chars
 * @param {number} length
 */
function generate(chars, length) {
    return new Array(length).fill(null).map(v => chars[~~Math.random() * chars.length]).join("");
}
/**
 * @param {string} chars
 * @param {number} length
 */
function confirm(str, chars, length) {
    return new RegExp(`[${chars}]{${length},${length}}`).test(str);
}

class Unique {
    constructor() { }

    generateSkinId() {
        return generate(skinIdChars, 6);
    }
    generateVanisToken() {
        return generate(vanisTokenChars, 32);
    }

    confirmSkinId() {
        return confirm(skinIdChars, 6);
    }
    confirmVanisToken() {
        return confirm(vanisTokenChars, 32);
    }
}

module.exports = Unique;
