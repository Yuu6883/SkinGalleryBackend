

/** @type {import("jquery")} */
const $ = window.$;

const API = require("./api");
const Prompt = require("./prompt");
const Starfield = require("./starfield");

const emptySkinPanel = 
`<div class="uk-width-1-5@m uk-card uk-margin-top">
    <div class="uk-padding-small uk-inline-clip uk-transition-toggle pointer uk-text-center card">
        <img src="assets/img/logo-grey.png" class="skin-preview skin-empty">
        <div class="uk-position-center">
            <span class="text uk-transition-fade" uk-icon="icon:cloud-upload;ratio:2"></span>
        </div>
    </div>
</div>`;

/** @param {{skinID:string,skinName:string,status:SkinStatus}} skinObject */
const linkedSkinPanel = skinObject => {

    let link = skinObject.status === "approved" ? `/s/${skinObject.skinID}` : `/api/p/skin/${skinObject.skinID}`;
    let labelClass = { "approved": "success", "pending": "warning", "rejected": "danger" }[skinObject.status];
    return "" +
    `<div class="uk-width-1-5@m uk-card uk-margin-top">
        <div class="uk-padding-small uk-inline-clip pointer uk-text-center card">
            <div class="uk-position-top-center uk-label uk-label-${labelClass}">${skinObject.status}</div>
            <img src="${link}" class="skin-preview">
        </div>
    </div>`
}

window.API = API;

$(window).on("load", () => {

    new Starfield($("#starfield")[0]).start();

    // API.on("needToLogin", () => Prompt.login().then(() => API.redirectLogin()));
    $("#logout").click(() => API.logout());
    $("#login").click(() => API.redirectLogin());

    API.on("loginSuccess", () => {
        $("#login-panel").hide();
        $("#user-panel").show();
        $("#user-pfp").attr("src", API.avatarURL);
        $("#username").text(API.fullName);
        $("#skin-panel").show();

        API.listSkin();
    });

    API.on("logoutSuccess", () => {
        $("#login-panel").show();
        $("#user-panel").hide();
        $("#skin-panel").hide();
    });

    API.on("myskin", skins => {
        console.log(skins);

        let skinsHTML = skins.map(linkedSkinPanel).join("");
        let emptySkinsHTML = emptySkinPanel.repeat(10 - skins.length);            

        let panel = $("#skin-panel").children().first();
        panel.children().remove();
        panel.append($(skinsHTML), $(emptySkinsHTML).click(() => Prompt.inputImage()));
    });

    API.on("skinUploaded", res => {
        Prompt.skinResult(res).then(() => API.listSkin());
    })

    API.init();

    $(document).ajaxStart(() => Prompt.showLoader());
    $(document).ajaxComplete(() => Prompt.hideLoader());
});