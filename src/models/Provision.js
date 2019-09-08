const skinIDChars = "abcdefghijklmnopqrstuvwxyz1234567890";
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
    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
    }

    async generateSkinID() {
        /** @type {string} */
        let iteration;
        while (await this.app.skins.countBySkinID(iteration = generateToken(skinIDChars, 6)) > 0) ;
        return iteration;
    }
    async generateVanisToken() {
        /** @type {string} */
        let iteration;
        while (await this.app.users.countAuthedVanis(iteration = generateToken(vanisTokenChars, 32)) > 0) ;
        return iteration;
    }

    /**
     * @param {string} str
     */
    confirmDiscordID(str) {
        return /^[0-9]+$/.test(str);
    }
    /**
     * @param {string} str
     */
    confirmSkinID(str) {
        return confirmToken(str, skinIDChars, 6);
    }
    /**
     * @param {string} str
     */
    confirmSkinName(str) {
        return /^[\w]{1,16}$/.test(str);
    }
    /**
     * @param {string} str
     */
    confirmVanisToken(str) {
        return confirmToken(str, vanisTokenChars, 32);
    }

    /**
     * @param {UserDocument} user
     * @param {boolean} attemptRefresh
     * @returns {DiscordUser | false | null}
     */
    async ensureDiscordAuthorization(user, attemptRefresh = true) {
        const discordInfo = await this.app.discordAPI.fetchUserInfo(user.discordToken);
        if (discordInfo.error == null)
            return discordInfo;
        // Couldn't fetch - try refreshing
        if (!attemptRefresh) {
            // Already tried refreshing and failed requesting info again
            this.logger.onError(`Failed to fetch info after refresh: ${discordInfo.error} (${discordInfo.error_description})`);
            return null;
        }
        const refreshResponse = await this.app.discordAPI.exchange(user.discordRefresh, true);
        if (refreshResponse.error == null) {
            // Refreshing failed
            this.logger.onError(`Failed to refresh token: ${discordInfo.error} (${discordInfo.error_description})`);
            return null;
        }
        // Reauthorize on Vanis
        await this.app.users.authorize(user.discordID, refreshResponse.access_token, refreshResponse.refresh_token);
        return await this.ensureDiscordAuthorization(user, false);
    }
}

module.exports = Provision;
