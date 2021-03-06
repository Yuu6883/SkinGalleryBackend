const skinIDChars = "abcdefghijklmnopqrstuvwxyz1234567890";
const tokenChars = "abcdef1234567890";

/**
 * @param {string} chars
 * @param {number} length
 */
function generateToken(chars, length) {
    return new Array(length).fill(null).map(_ => chars[~~(Math.random() * chars.length)]).join("");
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
    
    async generateToken() {
        /** @type {string} */
        let iteration;
        while (await this.app.users.countAuthed(iteration = generateToken(tokenChars, 32)) > 0) ;
        return iteration;
    }

    /**
     * @param {string} str
     */
    confirmDiscordID(str) {
        return str && /^[0-9]+$/.test(str);
    }

    /**
     * @param {string} str
     */
    confirmSkinID(str) {
        return str && confirmToken(str, skinIDChars, 6);
    }
    
    /**
     * @param {string} str
     */
    confirmSkinName(str) {
        return str && str.length <= 16 && str.length > 0;
    }

    /**
     * @param {string} str
     */
    confirmToken(str) {
        return str && confirmToken(str, tokenChars, 32);
    }

    /**
     * @param {string} str
     */
    confirmPNG(str) {
        // Image header and Base64 regex
        return str && /^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(str);
    }

    /** @param {String} discordID */
    createdRecently(discordID) {
        let snowflake = BigInt(discordID).toString(2).padStart(64, "0");
        
        snowflake = parseInt(snowflake.slice(0, -22), 2);

        let timestamp = snowflake + 1420070400000;
        let limit = this.app.config.recentLimit || 7 * 24 * 60 * 60 * 1000;

        return Date.now() - timestamp < limit;
    }

    /**
     * @param {UserDocument} user
     * @param {boolean} attemptRefresh
     * @returns {DiscordUser | false | null}
     */
    async ensureDiscordAuthorization(user, attemptRefresh = true) {
        const discordInfo = await this.app.discordAPI.fetchUserInfo(user.discordToken);
        if (!discordInfo.error)
            return discordInfo;
        // Couldn't fetch - try refreshing
        if (!attemptRefresh) {
            // Already tried refreshing and failed requesting info again
            this.logger.onError(`Failed to fetch info after refresh: ${discordInfo.error} (${discordInfo.error_description})`);
            return null;
        }
        const refreshResponse = await this.app.discordAPI.exchange(user.discordRefresh, true);
        if (!refreshResponse.error) {
            // Refreshing failed
            this.logger.onError(`Failed to refresh token: ${discordInfo.error} (${discordInfo.error_description})`);
            return null;
        }
        // Reauthorize
        await this.app.users.authorize(user.discordID, refreshResponse.access_token, refreshResponse.refresh_token);
        return await this.ensureDiscordAuthorization(user, false);
    }
}

Provision.generateToken = generateToken;
Provision.letterDigits = tokenChars;

module.exports = Provision;
