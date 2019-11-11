const { EventEmitter } = require("events");
const DecryptSkin = require("./decode");
const Crypto = require("crypto");

/** @typedef {{ username: String, discriminator: String, avatar: String, id: String }} UserInfo */

module.exports = new class API extends EventEmitter {

    constructor() {
        super();
        this.jwt = "";
        /** @type {UserInfo} */
        this.userInfo = null;
        /** @type {ClientSkinWithHash[]} */
        this.mySkins = [];
        /** @type {ClientSkin[]} */
        this.favorites = [];

        this.listTimestamp = 0;
        this.pubTimestamp  = 0;

        /** @type {"-time"|"time"|"-fav"|"fav"|"-name"|"name"} */
        this.sort = "-time";
    }
    
    /** @param {string} id */
    validateID(id) { return /^\w{6}$/.test(id) }

    /** @param {string} skinID */
    async getSkinHash(skinID, pending) {
        if (!this.validateID(skinID)) return;

        let img = document.createElement("img");
        /** @type {Promise<HTMLImageElement} */
        let loadImagePromise = new Promise(resolve => {
            img.onload = () => resolve(img);
            img.onerror = img.onabort = _ => resolve();
        });

        img.src = `${window.origin}/${pending ? "p" : "s"}/${skinID}`;
        img.crossOrigin = "anonymous";

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

    set myTotal(value) {
        $("#my-tab").attr("uk-tooltip", `${value}/60`);
    }

    set favTotal(value) {
        $("#fav-tab").attr("uk-tooltip", `${value}/200`);
    }

    set pubTotal(value) {
        $("#pub-tab").attr("uk-tooltip", `${value}`);
    }

    init() {
        this.on("loginSuccess",  async () => {
                localStorage.autoLogin = "ha";
                this.listFavSkin();
                let result = await this.getPublic({});
                this.pubTotal = result.total;                
            })
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
            global: false,
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

    listSkin(force = false, owner = "@me") {

        if (!force && Date.now() - this.listTimestamp < 2500)
            return;
        this.listTimestamp = Date.now();

        $.get({
            url: "/api/skins/" + owner,
            dataType: "json",
            success: 
            /** @param {ClientSkin[]} res */
            async res => {
                this.emit("myskin", res);

                let temp = [];
                for (let s of res) {
                    let old = this.mySkins.find(skin => skin.skinID == s.skinID);
                    
                    if (old && old.hash) {
                        old.status = s.status;
                        old.public = s.public;
                        old.tags   = s.tags;
                        old.favorites = s.favorites;
                        continue;
                    }
                    // console.log(`Calculating image hash for ${s.skinID}`);

                    s.hash = await this.getSkinHash(s.skinID, s.status != "approved");
                    // console.log(`Hash: ${s.hash}`);

                    // if (!s.hash) 
                    //     console.error(`Failed to calculate image hash for ${s.skinID}`);
                    temp.push(s);
                }

                this.mySkins.push(...temp);
                this.myTotal = this.mySkins.length;
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
                    
                    let index = this.mySkins.findIndex(s => s.skinID == skinID);
                    if (index > 0) this.mySkins.splice(index, 1);

                    this.emit("skinDeleteSuccess", name);
                }
            },
            error: console.error
        });
    }

    /** @param {String} skinID */
    addFavSkin(skinID) {

        if (this.favorites.length >= 200) {
            this.emit("error", "You can't star more than 200 skins");
            return;
        }

        $.ajax({
            method: "PUT",
            url: `/api/fav/${skinID}`,
            dataType: "json",
            success: res => {
                if (res.success) {
                    this.favorites.push(res.skin);
                    this.favTotal = this.favorites.length;
                    this.emit("favAdded");
                } else {
                    this.emit("error", res.error);
                }
            },
            error: console.error
        });
    }

    /** @param {String} skinID */
    deleteFavSkin(skinID) {
        $.ajax({
            method: "DELETE",
            url: `/api/fav/${skinID}`,
            dataType: "json",
            success: res => {
                if (res.success) {
                    let index = this.favorites.findIndex(s => s.skinID == skinID);
                    if (index >= 0) this.favorites.splice(index, 1);
                    this.favTotal = this.favorites.length;
                    this.emit("favDelete", name);
                }
            },
            error: console.error
        });
    }

    listFavSkin() {
        $.get({
            url: "/api/fav/@me",
            dataType: "json",
            success: res => {
                if (Array.isArray(res)) {
                    this.favorites = res;
                    this.favTotal = this.favorites.length;
                }
            },
            error: console.error
        });
    }

    /**
     * @param {{sort:"-time"|"time"|"-fav"|"fav"|"-name"|"name",force:boolean,page:number,tags:string[]}} param0 
     */
    async getPublic({ page=0, sort=this.sort, force=false, tags }) {

        tags = tags || [];

        if (!force && Date.now() - this.pubTimestamp < 2500)
            return;
        this.pubTimestamp = Date.now();

        let res = await fetch(`/api/public?page=${~~page}&sort=${sort}`);
        let total = ~~res.headers.get("x-skin-total");

        let buffer = await res.arrayBuffer();
        let skins = DecryptSkin(buffer);
        sort[0] == "-" && skins.reverse();
        return { total, skins };
    }
}
