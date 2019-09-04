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
        window.location.replace(window.location.href.match(/^https?:\/\/\w+\//)[0] + "api/login");
    }

    login() {
        $.ajax({
            method: "POST",
            url: "/api/login",
            dataType: "json",
            success: res => {
                this.userInfo = res;
                this.emit("loginSuccess");
            },
            error: err => {
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
        $.ajax({
            method: "POST",
            url: "/api/logout",
            success: res => {
                this.emit("logoutSuccess");
            },
            error: err => {
                this.emit("logoutFail");
            }
        });
    }
}
