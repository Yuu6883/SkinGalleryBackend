/** @type {import("sweetalert2").default} */
const Swal = window.Swal;
const API = require("./api");

/** 
 * @param {File} file 
 * @returns {Promise.<{name:String,img:HTMLImageElement}>}
 */
const readImage = file => new Promise(resolve => {
    let img = new Image();
    img.onload = () => resolve({ name: file.name, img });
    img.src = URL.createObjectURL(file);
});

module.exports = new class Prompt {
    
    constructor() {
        
        this.alert = Swal.mixin({
            background: '#222',
            width: "50%",
            heightAuto: false,
            focusConfirm: false,
            focusCancel: true,
            allowEnterKey: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                title: "text",
                content: "text",
                confirmButton: "btn",
                cancelButton: "btn danger"
            }
        });

    }

    /** @param {string} text */
    showLoader(text) {

        return this.alert.fire({
            background: "transparent",
            showConfirmButton: false,
            showCancelButton: false,
            title: $(`<div class="lds-spinner">${"<div></div>".repeat(12)}<div>`),
            text: text || "",
            timer: 10000,
        });
    }

    hideLoader() {
        if ($(".lds-spinner").length) {
            this.alert.close();
        } 
    }

    inputImage() {
        this.alert.fire({
            title: "Upload Skin",
            html:   `<div class="uk-placeholder uk-margin-top uk-text-center upload-holder pointer uk-width-expand uk-vertical-align-middle upload-panel" uk-form-custom>
                        <span class="uk-text-middle text">Attach skin by dropping here <br> or click to select one </span>
                        <span class="text" uk-icon="icon: cloud-upload"></span>
                        <input class="pointer" type="file" accept="image/*" id="skin-input">
                    </div>`,
            confirmButtonText: "Cancel",
            confirmButtonClass: "btn danger",
            onOpen: () => {
                let self = this;
                $("#skin-input").change(function() {
                    readImage(this.files.item(0)).then(skin => self.editSkin(skin));
                });
            }
        });
    }

    /** @param {{name:String,img:HTMLImageElement}} skin */
    editSkin(skin) {
        let canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        $(canvas).addClass("skin-preview");

        let ctx = canvas.getContext("2d");
        ctx.arc(256, 256, 256, 256, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(skin.img, 0, 0, 512, 512);

        let extraMessage = "";
        if (skin.img.width != 512 || skin.img.height != 512) 
            extraMessage = `Warning: Your image dimension is ${skin.img.width}x${skin.img.height}.` + 
                           ` 512x512 skin recommended. Other size will be force scaled.`

        this.alert.fire({
            title: "Preview",
            text: extraMessage,
            input: "text",
            inputClass: "text",
            inputAttributes: {
                maxLength: 16
            },
            inputAutoTrim: true,
            confirmButtonText: "Submit",
            showCancelButton: true,
            onOpen: () => {
                $(this.alert.getContent()).prepend(canvas);
                $(this.alert.getInput()).val(skin.name.split(".").slice(0, -1).join("."));
            }
        }).then(result => {
            if (result.dismiss) return;
            API.uploadSkin($(this.alert.getInput()).val(), canvas.toDataURL("image/jpeg", 1));
        });
    }

    /** @param {{status:SkinStatus}} res */
    skinResult(res) {
        switch (res.status) {
            case "approved":
                return this.alert.fire("Skin Approved", "Congratulations. Your skin passed the NSFW detection. " + 
                "Be aware that if the detection fails, your skin will still be banned.", "success");

            case "pending":
                return this.alert.fire("Skin Pending", "Moderators are reviewing your skin " + 
                                    "because it might contain NSFW content.", "warning");

            case "rejected":
                return this.alert.fire("Skin Rejected", "Your skin most likely contains NSFW content." + 
                                    " You can appeal to moderators on discord if it's actually SFW.");

        }
    }

}