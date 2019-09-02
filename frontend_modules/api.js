const { EventEmitter } = require("events");

/** @type {import("jquery")} */
const $ = window.$;

module.exports = new class API extends EventEmitter {

    constructor() {
        super();
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
                this.emit("loginSuccess");
                console.log(res);
            },
            error: err => {
                this.emit("loginFail");
            }
        });
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
}
