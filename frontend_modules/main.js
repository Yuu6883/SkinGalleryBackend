

/** @type {import("jquery")} */
const $ = window.$;

const API = require("./api");
const Prompt = require("./prompt");
const Starfield = require("./starfield");

const emptySkinPanel = 
`<div class="uk-width-1-5@l uk-width-1-2@m uk-card uk-margin-top">
    <div class="padding-s uk-inline-clip uk-transition-toggle uk-text-center card">
        <img src="assets/img/logo-grey.png" class="skin-preview skin-empty">
        <div class="uk-position-center">
            <span class="text uk-transition-fade pointer skin-upload" uk-icon="icon:cloud-upload;ratio:2" uk-tooltip="Upload skin"></span>
        </div>
    </div>
</div>`;

const escapeHtml = unsafe => unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");

/** @param {{skinID:string,skinName:string,status:SkinStatus}} skinObject */
const linkedSkinPanel = skinObject => {

    let link = skinObject.status === "approved" ? `/s/${skinObject.skinID}` : `/api/p/skin/${skinObject.skinID}`;
    let labelClass = { "approved": "success", "pending": "warning", "rejected": "danger" }[skinObject.status];
    return "" +
    `<div class="uk-width-1-5@l uk-width-1-2@m uk-card uk-margin-top">
        <div class="padding-s uk-inline-clip pointer uk-text-center uk-transition-toggle card">
            <div>
                <a href="${link}" data-type="image" data-caption="<h1 class='text uk-margin-large-bottom'>${escapeHtml(skinObject.skinName)}</h1>">
                    <img src="${link}" class="skin-preview uk-transition-scale-up uk-transition-opaque">
                </a>
            </div>
            <div class="top-right uk-label uk-label-${labelClass} uk-transition-slide-top">${skinObject.status}</div>
            <h3 class="text uk-position-bottom-center uk-margin-small-bottom">${escapeHtml(skinObject.skinName)}</h3>
            <div class="bottom-right">
                ${skinObject.status === "approved" ? `<span uk-icon="icon:link;ratio:1.5"      class="text uk-transition-slide-bottom skin-link"
                link="${window.location.origin}${link}" uk-tooltip="Copy skin URL"></span><br>` : ""}
                <span uk-icon="icon:file-edit;ratio:1.5" class="text uk-transition-slide-bottom skin-edit"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" uk-tooltip="Edit this skin's name"></span><br>
                <span uk-icon="icon:trash;ratio:1.5"     class="text uk-transition-slide-bottom skin-delete"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" uk-tooltip="Delete this skin"></span>
            </div>
        </div>
    </div>`
}

let copyEl;
$(window).on("load", () => {

    copyEl = document.getElementById("copy");

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

    API.on("myskin", skins => updateSkinPanel(skins));

    API.on("skinUploaded", res => {
        if (res.error) return console.error(res.error);
        Prompt.skinResult(res).then(() => API.listSkin());
    });

    API.on("skinEditSuccess", newName => {
        Prompt.skinEditResult(newName).then(() => API.listSkin());
    });

    API.on("skinDeleteSuccess", name => {
        Prompt.skinDeleteResult(name).then(() => API.listSkin());
    });

    API.init();

    $(document).ajaxStart(() => Prompt.showLoader());
    $(document).ajaxComplete(() => Prompt.hideLoader());
});

const updateSkinPanel = skins => {
    let skinsHTML = skins.map(linkedSkinPanel).join("");
    let emptySkinsHTML = emptySkinPanel.repeat(10 - skins.length);            

    let panel = $("#skin-panel").children().first();
    panel.children().remove();
    panel.append($(skinsHTML + emptySkinsHTML));

    $(".skin-upload").click(() => Prompt.inputImage());

    $(".skin-edit").click(function() {
        Prompt.editSkinName($(this).attr("skin-id"), $(this).attr("skin-name"));
    });

    $(".skin-delete").click(function() {
        Prompt.deleteSkin($(this).attr("skin-id"), $(this).attr("skin-name"));
    });

    $(".skin-link").click(function() {

        $(copyEl).val($(this).attr("link"));
        $(copyEl).text($(this).attr("link"));
        
        if (copyText(copyEl))
            Prompt.copied($(copyEl).val());
        else
            Prompt.copyFail($(copyEl).val());
    });
}

const copyText = element => {
    let range, selection;
  
    if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(element);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();        
        range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    try {
        document.execCommand('copy');
        return true;
    }
    catch (err) {
        return false;
    }
}