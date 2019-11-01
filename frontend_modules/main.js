

/** @type {import("jquery")} */
const $ = window.$;

const API = require("./api");
const Prompt = require("./prompt");
const Starfield = require("./starfield");

const emptySkinPanel = 
`<div class="uk-width-1-5@l uk-width-1-4@m uk-width-1-2 uk-card uk-margin-top">
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

/** @param {{skinID:string,skinName:string,status:SkinStatus,public:boolean}} skinObject */
const linkedSkinPanel = skinObject => {

    let link = skinObject.status === "approved" ? `/s/${skinObject.skinID}` : `/api/p/skin/${skinObject.skinID}`;
    let labelClass = { "approved": "success", "pending": "warning", "rejected": "danger" }[skinObject.status];
    return "" +
    `<div class="uk-width-1-5@l uk-width-1-4@m uk-width-1-2 uk-card uk-margin-top">
        <div class="padding-s uk-inline-clip pointer uk-text-center uk-transition-toggle card">
            <div>
                <a href="${link}" data-type="image" data-caption="<h1 class='text uk-margin-large-bottom'>${escapeHtml(skinObject.skinName)}</h1>">
                    <img src="${link}" class="skin-preview uk-transition-scale-up uk-transition-opaque">
                </a>
            </div>
            <div class="top-right uk-label uk-label-${labelClass} uk-transition-slide-top">${skinObject.status}</div>
            <h3 class="text uk-position-bottom-center uk-margin-small-bottom">${escapeHtml(skinObject.skinName)}</h3>
            <div class="top-left">
                <span uk-icon="icon:${skinObject.public ? "users" : "lock"};ratio:1.5" 
                      class="text uk-transition-slide-top info skin-edit ${skinObject.public ? "" : "danger-text"}"
                      skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" ${skinObject.public ? "skin-public='true'" : ""} 
                      uk-tooltip="This skin is ${skinObject.public ? "public" : "private"}"></span>
            </div>
            <div class="bottom-right">
                ${skinObject.status === "approved" ? `<span uk-icon="icon:link;ratio:1.5"      class="text uk-transition-slide-bottom skin-link"
                link="${window.location.origin}${link}" uk-tooltip="Copy skin URL"></span><br>` : ""}

                <span uk-icon="icon:file-edit;ratio:1.5" class="text uk-transition-slide-bottom skin-edit"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" ${skinObject.public ? "skin-public='true'" : ""} 
                        uk-tooltip="Edit this skin"></span><br>

                <span uk-icon="icon:trash;ratio:1.5"     class="text uk-transition-slide-bottom skin-delete"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" uk-tooltip="Delete this skin"></span>
            </div>
        </div>
    </div>`
}

let copyEl;
$(window).on("load", () => {

    copyEl = document.getElementById("copy");

    let halloween = false;
    let today = new Date();
    let month = today.getMonth() + 1; // Autism
    let date  = today.getDate();

    if (localStorage.theme == "halloween" || 
        (month == 10 && date >= 15) ||
        (month == 11 && date == 1)) {
            
        halloween = true;
        // Halloween theme
        $(":root").prop("style").setProperty("--background-color", " rgba(30,13,0,.75) ");
        $(":root").prop("style").setProperty("--card--color",      "  #351733 ");

        $("#extra-info").html(`<img width="30" height="30" src="assets/img/pumpkin.png">` + 
                                `<span>Happy Halloween!</span>` + 
                              `<img width="30" height="30" src="assets/img/pumpkin.png">`);
    }

    new Starfield($("#starfield")[0], { halloween }).start();

    $("#login").click(() => API.redirectLogin());
    $("#logout").click(() => API.logout());
    $("#upload").click(() => Prompt.inputImage());

    API.on("loginSuccess", () => {
        $("#login-panel").hide();
        $("#user-panel").show();
        $("#user-pfp").attr("src", API.avatarURL);
        $("#username").text(API.fullName);
        $("#skin-panel").show();

        API.listSkin();
        $(".center").css("min-height", "100%");
    });

    API.on("logoutSuccess", () => {
        $("#login-panel").show();
        $("#user-panel").hide();
        $("#skin-panel").hide();
    });

    API.on("banned", date => Prompt.showBanned(date).then(() => {
        $("#login-panel").hide();
        $("#user-panel").show();
        $("#user-pfp").attr("src", "assets/img/lmao.png");
        $("#username").html("<strong>ACHIEVEMENT UNLOCKED</strong><br> You have been banned");
    }));

    API.on("myskin", skins => updateSkinPanel(skins));
    API.on("duplicate", s => Prompt.warnDuplicate(s))

    API.on("skinUploaded", res => {
        if (res.error) return console.error(res.error);
        Prompt.skinResult(res).then(() => API.listSkin());
    });

    API.on("skinEditSuccess", ({ newName, isPublic }) => {
        Prompt.skinEditResult({ name: escapeHtml(newName), isPublic })
              .then(() => API.listSkin());
    });

    API.on("skinDeleteSuccess", name => {
        Prompt.skinDeleteResult(escapeHtml(name))
              .then(() => API.listSkin());
    });

    API.init();

    $(document).ajaxStart(() => Prompt.showLoader());
    $(document).ajaxComplete(() => Prompt.hideLoader());
    $(document).ajaxError((_, xhr) => {
        Prompt.alert.fire({
            title: `Error[${xhr.status}]: ${xhr.statusText}`,
            text: "Please report this issue on discord.",
            type: "error"
        });
    });
});

const updateSkinPanel = async skins => {
    let skinsHTML = skins.map(linkedSkinPanel).join("");
    let emptySkinsHTML = emptySkinPanel.repeat(20 - skins.length);            

    let panel = $("#my-skins");
    await new Promise(resolve => panel.fadeOut(300, resolve));

    panel.children().remove();
    panel.append($(skinsHTML + emptySkinsHTML));

    $(".skin-upload").click(() => Prompt.inputImage());

    $(".skin-edit").click(function() {
        Prompt.editSkin({ 
            skinID: $(this).attr("skin-id"),
            oldName: $(this).attr("skin-name"),
            wasPublic: !!$(this).attr("skin-public") });
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

    await new Promise(resolve => panel.fadeIn(300, resolve));
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