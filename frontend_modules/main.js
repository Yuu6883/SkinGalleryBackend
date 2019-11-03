const escapeHtml = unsafe => unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
         
$(window).on("load", () => {

    const API = require("./api");
    const Prompt = require("./prompt");
    const Pager = require("./pager");
    const Starfield = require("./starfield");
    
    window.API = API;
    window.Pager = Pager;

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

    API.on("myskin", skins => Pager.viewMySkins(skins));
    API.on("duplicate", s => Prompt.warnDuplicate(s));

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