const { EventEmitter } = require("events");

/** @typedef {{ username: String, discriminator: String, avatar: String, id: String }} UserInfo */
/** @type {import("jquery")} */
const $ = window.$;

module.exports = new class API extends EventEmitter {

    constructor() {
        super();
        this.jwt = "";
        /** @type {UserInfo} */
        this.userInfo = null;
    }

    init() {

        this.on("loginSuccess", () => localStorage.autoLogin = "ha")
            .on("loginFail", () => delete localStorage.autoLogin)
            .on("logoutSuccess", () => delete localStorage.autoLogin)
            .on("logoutFail", () => delete localStorage.autoLogin);

        if (localStorage.autoLogin) this.login();
        else this.emit("needToLogin");
    }

    redirectLogin() {
        localStorage.autoLogin = "ha";
        window.location.replace(window.location.href.match(/^https?:\/\/.+\//)[0] + "api/login");
    }

    login() {
        $.post({
            url: "/api/login",
            dataType: "json",
            success: res => {
                this.userInfo = res;
                this.emit("loginSuccess");
            },
            error: () => {
                this.emit("loginFail");
            }
        });
    }

    get fullName() {
        return this.userInfo.username + "#" + this.userInfo.discriminator;
    }

    get avatarURL() {
        return `https://cdn.discordapp.com/avatars/${this.userInfo.id}/${this.userInfo.avatar}.png`;
    }

    logout() {
        $.post({
            url: "/api/logout",
            success: () => {
                this.emit("logoutSuccess");
            },
            error: () => {
                this.emit("logoutFail");
            }
        });
    }

    uploadSkin(name, data) {
        $.post({
            url: "/api/skins/" + name,
            data,
            /** @param {{status:SkinStatus}} res */
            success: res => {
                this.emit("skinUploaded", res);
            },
            error: e => {
                console.error(e);
            }
        });
    }

    listSkin(owner = "@me") {
        $.get({
            url: "/api/skins/" + owner,
            dataType: "json",
            success: res => {
                if (owner === "@me") {
                    this.emit("myskin", res);
                }
            },
            error: console.error
        });
    }

    editSkinName(skinID, newName) {
        $.ajax({
            method: "PUT",
            url: `/api/skins/${skinID}?name=${newName}`,
            dataType: "json",
            success: res => {
                if (res.success) this.emit("skinEditSuccess", newName);
            },
            error: console.error
        });
    }

    deleteSkin(skinID, name) {
        $.ajax({
            method: "DELETE",
            url: `/api/skins/${skinID}`,
            dataType: "json",
            success: res => {
                if (res.success) this.emit("skinDeleteSuccess", name);
            },
            error: console.error
        });
    }
}
