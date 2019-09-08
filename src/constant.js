const p = {
    VISIT:              0x000001,
    LOGGED_IN:          0x000002,
    LOGIN:              0x000004,
    LOGOUT:             0x000008,

    LIST_OWNED_SKINS:   0x000010,
    LIST_OTHER_SKINS:   0x000020,

    UPLOAD_SKIN:        0x000100,
    MODIFY_SKIN:        0x000200,
    DELETE_SKIN:        0x000400,

    APPROVE_SKIN:       0x001000,
    REJECT_SKIN:        0x002000,

    BAN_USER:           0x010000,
    UNBAN_USER:         0x020000,

    SUDO:               0xFFFFFF
};

const NO_AUTH_LEVEL             = p.VISIT | p.LOGIN;
const USER_BASE_AUTH_LEVEL      = p.VISIT | p.LOGGED_IN | p.LOGOUT | p.LIST_OWNED_SKINS;
const USER_DEV_AUTH_LEVEL       = p.SUDO;

const USER_BANNED_AUTH_LEVEL    = USER_BASE_AUTH_LEVEL;
const USER_BASIC_AUTH_LEVEL     = USER_BASE_AUTH_LEVEL | p.UPLOAD_SKIN | p.MODIFY_SKIN | p.DELETE_SKIN;
const USER_MOD_AUTH_LEVEL       = USER_BASE_AUTH_LEVEL | p.APPROVE_SKIN | p.REJECT_SKIN | p.BAN_USER | p.UNBAN_USER;

module.exports = {
    WEB_STATIC_SOURCE: require("path").resolve(__dirname, "..", "web"),

    VANIS_TOKEN_COOKIE: "vanis_skin_token",
    VANIS_TOKEN_AGE: 30 * 24 * 60 * 60 * 1000,

    PERMISSIONS: p,
    AUTH_LEVELS: {
        NONE: NO_AUTH_LEVEL,
        USER: USER_BASIC_AUTH_LEVEL,
        USER_BANNED: USER_BANNED_AUTH_LEVEL,
        MOD: USER_MOD_AUTH_LEVEL,
        DEV: USER_DEV_AUTH_LEVEL
    },

    /**
     * @param {keyof p} permission
     * @param {number} permissions
     */
    hasPermission(permission, permissions) {
        return (permissions & p[permission]) === p[permission];
    }
};
