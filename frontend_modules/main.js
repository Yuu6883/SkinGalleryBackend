

/** @type {import("jquery")} */
const $ = window.$;

const API = require("./api");
const Prompt = require("./prompt");

$(window).on("load", () => {

    API.on("needToLogin", () => Prompt.login().then(() => API.login()));

    API.init();
});