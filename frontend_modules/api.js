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

    /**
     * @fires loginSuccess
     */
    login() {
        $.ajax({
            url: "/api/login",
            success: res => {
                this.emit("loginSuccess");
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
