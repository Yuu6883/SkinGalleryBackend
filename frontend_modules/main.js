

/** @type {import("jquery")} */
const $ = window.$;

const API = require("./api");
const Prompt = require("./prompt");
const Starfield = require("./starfield");

$(window).on("load", () => {

    new Starfield($("#starfield")[0]).start();

    API.on("needToLogin", () => Prompt.login().then(() => API.login()));

    API.init();
});