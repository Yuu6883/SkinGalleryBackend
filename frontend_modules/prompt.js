/** @type {import("sweetalert2").default} */
const Swal = window.Swal;

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
                content: "text"
            }
        });
        this.isLoading = false;

    }

    /** @param {string} text */
    showLoader(text) {
        this.isLoading = true;

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
        if (this.isLoading) {
            this.alert.close();
            this.isLoading = false;
        } 
    }

}