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

/** @param {Date} date */
const MMDDYYYY = date => `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;

module.exports = new class Prompt {
    
    constructor() {
        
        this.alert = Swal.mixin({
            heightAuto: false,
            focusConfirm: false,
            focusCancel: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                popup: "uk-width-1-2@l uk-width-2-3@m uk-width-4-5",
                title: "text",
                content: "text",
                confirmButton: "btn",
                cancelButton: "btn danger",
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
            showCancelButton: true,
            confirmButtonText: "Continue",
            input: "url",
            inputPlaceholder: "Or enter image URL here",
            onOpen: () => {
                let self = this;
                $("#skin-input").change(function() {
                    readImage(this.files.item(0)).then(skin => self.confirmSkin(skin));
                });
            }
        }).then(result => {
            if (result.dismiss) return;
            let url = result.value;

            if (url) {
                let img = new Image;
                img.crossOrigin = "anonymous";
                img.onload = () => this.confirmSkin({ name: url.split("/").slice(-1)[0], img });
                img.onabort = img.onerror = () => this.alert.fire("Invalid Skin URL", `Failed to load image from ${url}`, "error");
                img.src = url;
            }
        });
    }

    showBanned(date) {
        return this.alert.fire("Ops...", `You are banned until ${MMDDYYYY(date)}`, "warning");
    }

    /** @param {{name:String,img:HTMLImageElement}} skin */
    confirmSkin(skin) {
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

        let isPublic = true;
        this.alert.fire({
            title: "Preview",
            text: extraMessage,
            input: "text",
            inputClass: "text",
            inputAttributes: {
                maxLength: 16
            },
            inputValidator: value => !(value && value.length <= 16),
            inputAutoTrim: true,
            confirmButtonText: "Submit",
            showCancelButton: true,
            inputValue: skin.name.split(".").slice(0, -1).join(".").slice(0, 16),
            onOpen: () => {
                $(this.alert.getContent()).prepend(canvas);
                $(this.alert.getContent()).append(
                    $(`<label><input class="uk-checkbox" type="checkbox" checked>` + 
                    ` <strong>Public</strong> (visible to everyone)</label>`)
                        .click(function() { isPublic = $(this).is(":checked") })
                );
            }
        }).then(result => {
            if (result.dismiss) return;
            API.uploadSkin($(this.alert.getInput()).val(), canvas.toDataURL("image/png", 1), isPublic);
        });
    }

    /** @param {{status:SkinStatus}} res */
    skinResult(res) {
        switch (res.status) {
            case "approved":
                return this.alert.fire("Skin Approved", "Be aware that if this skin can still be banned if it contains ruling-breaking components.", "success");

            case "pending":
                return this.alert.fire("Skin Pending", "Your skin is being manually reviewed because it might contain ruling-breaking components.", "warning");

            case "rejected":
                return this.alert.fire("Skin Rejected", "Your skin most likely contains ruling-breaking components., which is not allowed.");

            default:
                console.error(`Unknown status: ${res.status}`);

        }
    }

    skinEditResult({ name, isPublic }) {
        return this.alert.fire("Success", `Skin <strong>${name}</strong> is ${isPublic ? "public" : "private"}`, "success");
    }

    skinDeleteResult(skinName) {
        return this.alert.fire("Success", `Skin ${skinName} deleted`, "success");
    }

    /**
     * @param {{ skinID: string, oldName: string, wasPublic: boolean }} param0
     */
    editSkin({skinID, oldName, wasPublic }) {
        let isPublic = wasPublic;
        this.alert.fire({
            title: "Edit Skin",
            input: "text",
            inputAttributes: {
                maxLength: 16
            },
            inputAutoTrim: true,
            confirmButtonText: "Save",
            showCancelButton: true,
            inputValue: oldName,
            onOpen: () => {
                $(this.alert.getContent()).append(
                    $(`<label><strong>Public</strong> (visible to everyone)</label>`)
                        .prepend( 
                            $(`<input class="uk-checkbox" type="checkbox">`)
                                .attr("checked", wasPublic)
                                .click(function() { isPublic = $(this).is(":checked") })),                       
                );
            }
        }).then(result => {
            if (result.dismiss) return;
            if (result.value == oldName && isPublic == wasPublic) {
                this.alert.fire("No changes to be made", "", "warning");
            } else API.editSkin({ skinID, newName: result.value, isPublic });
        });
    }
    
    deleteSkin(skinID, name) {
        this.alert.fire({
            title: `Delete Skin`,
            type: "warning",
            text: `You are about to delete skin ${name}`,
            confirmButtonClass: "btn danger",
            confirmButtonText: "Delete",
            showCancelButton: true
        }).then(result => {
            if (result.dismiss) return;
            API.deleteSkin(skinID, name);
        });
    }

    copied(url) {
        this.alert.fire({
            allowOutsideClick: true,
            showConfirmButton: false,
            timer: 2000,
            type: "success",
            title: "Linked Copied to Clipboard",
            text: url
        });
    }

    copyFail(url) {
        this.alert.fire({
            allowOutsideClick: true,
            title: "Failed to Copy to Clipboard",
            text: "You can copy the link manually",
            inputValue: url,
            type: "error"
        });
    }
}