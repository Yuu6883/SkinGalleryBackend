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

    }

    login() {
        return this.alert.fire({
            title: "Log In with Discord",
            confirmButtonColor: "#7289da",
            confirmButtonText: "Continue"
        });
    }

}