const { EventEmitter } = require("events");
const Crypto = require("crypto");

/** @typedef {{ username: String, discriminator: String, avatar: String, id: String }} UserInfo */
/** @type {import("jquery")} */
const $ = window.$;

module.exports = new class API extends EventEmitter {

    constructor() {
        super();
        this.jwt = "";
        /** @type {UserInfo} */
        this.userInfo = null;
        /** @type {ClientSkinWithHash[]} */
        this.mySkins = [];
    }

    /** @param {string} skinID */
    async getSkinHash(skinID) {
        if (!this.validateID(skinID)) return;

        let img = document.createElement("img");
        /** @type {Promise<HTMLImageElement} */
        let loadImagePromise = new Promise(resolve => {
            img.onload = () => resolve(img);
            img.onerror = img.onabort = resolve();
        });

        img.src = `${window.origin}/s/${skinID}`;

        let imageLoaded = await loadImagePromise;
        if (!imageLoaded) return;

        let canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height);
        return this.hash(canvas.toDataURL("image/png", 10));
    }

    /** @param {string} data */
    hash(data) {
        let hash = Crypto.createHash('sha256');
        hash.update(data);
        return hash.digest("hex");
    }

    /** @param {string} dataURL */
    checkDuplicate(dataURL) {
        let hash = this.hash(dataURL);
        return this.mySkins.find(s => s.hash == hash);
    }

    init() {
        this.on("loginSuccess",  () => localStorage.autoLogin = "ha")
            .on("loginFail",     () => delete localStorage.autoLogin)
            .on("logoutSuccess", () => delete localStorage.autoLogin)
            .on("logoutFail",    () => delete localStorage.autoLogin);

        if (localStorage.autoLogin) this.login();
        else this.emit("needToLogin");
    }

    redirectLogin() {
        localStorage.autoLogin = "ha";
        window.location.replace(window.location.href.match(/^https?:\/\/.+\//)[0] + "api/login");
    }

    login() {
        $.post({
            url: "/api/login",
            dataType: "json",
            success: res => {
                this.userInfo = res;
                if (res.bannedUntil > Date.now()) {
                    this.emit("banned", new Date(res.bannedUntil));
                } else {
                    this.emit("loginSuccess");
                }
            },
            error: () => {
                this.emit("loginFail");
            }
        });
    }

    get fullName() {
        return this.userInfo.username + "#" + this.userInfo.discriminator;
    }

    get avatarURL() {
        return `https://cdn.discordapp.com/avatars/${this.userInfo.id}/${this.userInfo.avatar}.png`;
    }

    logout() {
        $.post({
            url: "/api/logout",
            success: () => {
                this.emit("logoutSuccess");
            },
            error: () => {
                this.emit("logoutFail");
            }
        });
    }

    uploadSkin(name, data, isPublic) {

        let dup = this.checkDuplicate(data);
        if (dup) {
            this.emit("duplicate", dup);
            return;
        }

        $.post({
            url: `/api/skins/${encodeURIComponent(name)}${isPublic ? "?public=true" : ""}`,
            data,
            /** @param {{status:SkinStatus}} res */
            success: res => {
                this.emit("skinUploaded", res);
            },
            error: e => {
                console.error(e);
            }
        });
    }

    listSkin(owner = "@me") {
        $.get({
            url: "/api/skins/" + owner,
            dataType: "json",
            success: 
            /** @param {ClientSkin[]} res */
            async res => {
                if (owner === "@me") {
                    this.emit("myskin", res);
                    let temp = [];
                    for (let s of res) {
                        if (this.mySkins.find(skin => skin.skinID == s.skinID))
                            return;
                        console.log(`Calculating image hash for ${s.skinID}`);

                        s.hash = await this.getSkinHash(s.skinID);

                        if (!s.hash) 
                            console.error(`Failed to calculate image hash for ${s.skinID}`);
                        temp.push(s);
                    }
                    this.mySkins = temp;
                }
            },
            error: console.error
        });
    }

    editSkin({ skinID, newName, isPublic }) {
        $.ajax({
            method: "PUT",
            url: `/api/skins/${skinID}?name=${encodeURIComponent(newName)}&public=${!!isPublic}`,
            dataType: "json",
            success: res => {
                if (res.success) this.emit("skinEditSuccess", { newName, isPublic });
            },
            error: console.error
        });
    }

    deleteSkin(skinID, name) {
        $.ajax({
            method: "DELETE",
            url: `/api/skins/${skinID}`,
            dataType: "json",
            success: res => {
                if (res.success) {
                    this.emit("skinDeleteSuccess", name);
                }
            },
            error: console.error
        });
    }
}
