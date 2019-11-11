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
const toUTF8 = str => unescape(encodeURIComponent(str));

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
            width: 0,
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
        let r = 512 / 2 + 1;
        ctx.arc(r, r, r, r, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(skin.img, 0, 0, 512, 512);

        let extraMessage = "";
        if (skin.img.width != 512 || skin.img.height != 512) 
            extraMessage = `Warning: Your image dimension is ${skin.img.width}x${skin.img.height}.` + 
                           ` 512x512 skin recommended. Other size will be force scaled.`

        let isPublic = true;
        let skinName = skin.name.split(".").slice(0, -1).join(".").slice(0, 16);
        this.alert.fire({
            title: "Preview",
            text: extraMessage,
            input: "text",
            inputClass: "text",
            inputAttributes: {
                maxLength: 16
            },
            /** @param {String} value */
            inputValidator: value => {
                this.alert.getInput().value = "";
                if (!value)
                    return "Skin name can't be empty";
                if (value.length > 16) 
                    return "Skin name must not be longer than 16 characters";
                for (let char of value.split("")) {
                    if (char != toUTF8(char))
                        return `Skin name must be UTF8 characters (${char} is not UTF8)`;
                }
                this.alert.getInput().value = value;
            },
            inputAutoTrim: true,
            confirmButtonText: "Submit",
            showCancelButton: true,
            inputValue: toUTF8(skinName),
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

    /** @param {ClientSkin} skin */
    warnDuplicate(skin) {
        if (skin.status == "approved") {
            this.alert.fire({
                title: "Duplicate Skin",
                imageUrl: `${window.origin}/s/${skin.skinID}`,
                imageClass: "skin-preview",
                html:  "Please try not to submit a duplicate skin. " +
                       `This skin is already approved: ` + 
                       `<a>${window.origin}/s/${skin.skinID}</a>`,
            });
        } else if (skin.status == "pending") {
            this.alert.fire({
                title: "Duplicate Skin",
                imageUrl: `${window.origin}/p/${skin.skinID}`,
                imageClass: "skin-preview",
                text:  "Please try not to submit a duplicate skin. " +
                       `This skin is pending right now. Moderators would normally review and ` + 
                       `most likely approve your skin in a few minutes. Your patience is appreciated.`,
            });
        } else if (skin.status == "rejected") {
            this.alert.fire({
                title: "Duplicate Skin",
                text:  "Please try not to submit a duplicate skin, " + 
                       "especially when the previous one is already rejected. " +
                       "Your action might cause your account to be banned from this website.",
                type: "warning",
            });
        }
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
    
    /**
     * @param {String} skinID
     * @param {String} name
     */
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

    /**
     * @param {String} skinID
     * @param {String} name
     */
    starSkin(skinID, name) {
        this.alert.fire({
            title: `Starring skin: ${name}`,
            imageUrl: `${window.origin}/s/${skinID}`,
            imageClass: "skin-preview",
            confirmButtonText: "Star",
            showCancelButton: true
        }).then(result => {
            if (result.value) {
                API.addFavSkin(skinID);
            }
        });
    }

    /**
     * @param {String} skinID
     * @param {String} name
     */
    unstarSkin(skinID, name, already = false) {
        this.alert.fire({
            title: `Unstar skin: ${name}`,
            text: already ? "You already starred this skin" : "",
            imageUrl: `${window.origin}/s/${skinID}`,
            imageClass: "skin-preview",
            confirmButtonClass: "btn danger",
            confirmButtonText: "Unstar",
            showCancelButton: true
        }).then(result => {
            if (result.value) {
                API.deleteFavSkin(skinID);
            }
        });
    }

    favAddSuccess() {
        this.alert.fire({
            title: "Skin Starred",
            text: "Yeet",
            type: "success",
            timer: 1500,
            showConfirmButton: false,
            showCancelButton: false
        });
    }

    favDeleteSuccess() {
        this.alert.fire({
            title: "Skin Unstarred",
            text: "RIP",
            type: "success",
            timer: 1500,
            showConfirmButton: false,
            showCancelButton: false
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