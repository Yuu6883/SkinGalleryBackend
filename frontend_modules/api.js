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
            success: res => {
                this.userInfo = this.parseJwt(res);
                this.jwt = res;
                this.logJwt();
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
            url: "/api/login",
            success: res => {
                this.emit("logoutSuccess");
            },
            error: err => {
                this.emit("logoutFail");
            }
        });
    }

    parseJwt(jwt) {
        var base64Url = jwt.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    }

    logJwt() {
        let jwt2 = this.jwt.split(/[.]/);
        console.log("%cJWT:", "font-weight:bold;");
        console.log("%c" + jwt2[0] + ".%c" + jwt2[1] + ".%c" + jwt2[2], "font-size:10px;color:#fb015b;", "font-size:10px;color:#d63aff;", "font-size:10px;color:#00b9f1;", '');
    }
}
