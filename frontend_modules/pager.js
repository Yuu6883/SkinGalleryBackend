const PAGE_LIMIT = 12;
const Prompt = require("./prompt");
/** @param {Number} p */
const createPage = (curr, p) => $(`<li><a class="page-${curr == p ? "active" : "btn"}">${p}</a></li>`);
/** @param {{curr:Number,total:Number,min:Number,onpage:Function}} param0 */
const createView = ({ curr, total, min, onpage }) => {

    total = Math.max(total, min);
    const prev = $(`<li><a class="page-${curr > 0         ? "btn" : "disable"}" id="prev-page">` + 
                   `<span uk-pagination-previous></span></a></li>`);
    const next = $(`<li><a class="page-${curr < total - 1 ? "btn" : "disable"}" id="next-page">` +
                   `<span uk-pagination-next    ></span></a></li>`);

    prev.click(() => curr > 0         && onpage(curr - 1));
    next.click(() => curr < total - 1 && onpage(curr + 1));

    let pages = [];

    if (total <= 9) {
        for (let i = 0; i < total; i++) {
            let page = createPage(curr + 1, i + 1);
            page.click(() => curr == i || onpage(i));
            pages.push(page);
        }
    } else {
        let indices = [0, 1, 2, total - 3, total - 2, total - 1];
        for (let i = 3; i < total - 3; i++)
            Math.abs(i - curr)  < 3 && indices.push(i);
        // Vacant value, push "..."
        indices.reduce((val, prev) => {
            let page = createPage(curr + 1, val == prev + 1 ? val + 1 : "...");
            page.click(() => curr == i || onpage(i));
            pages.push(page);
            return val;
        }, -1);
    }

    return [prev, ...pages, next];
}

const emptySkinPanel = 
`<div class="uk-width-1-6@l uk-width-1-4@m uk-width-1-2 uk-card uk-margin-top">
    <div class="padding-s uk-inline-clip uk-transition-toggle uk-text-center card">
        <img src="assets/img/logo-grey.png" class="skin-preview skin-empty">
        <div class="uk-position-center">
            <span class="text uk-transition-fade pointer skin-upload" uk-icon="icon:cloud-upload;ratio:2" uk-tooltip="Upload skin"></span>
        </div>
    </div>
</div>`;

/** @param {ClientSkin} skinObject */
const createMySkinPanel = skinObject => {

    let link = skinObject.status === "approved" ? `/s/${skinObject.skinID}` : `/p/${skinObject.skinID}`;
    let labelClass = { "approved": "success", "pending": "warning", "rejected": "danger" }[skinObject.status];
    return "" +
    `<div class="uk-width-1-6@l uk-width-1-4@m uk-width-1-2 uk-card uk-margin-top">
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
            <div class="bottom-left">
                <span uk-icon="icon:star;ratio:1.5" class="text uk-transition-slide-bottom info skin-stars"
                      uk-tooltip="${skinObject.favorites} stars"></span>
            </div>
            <div class="bottom-right">
                ${skinObject.status === "approved" ? `<span uk-icon="icon:link;ratio:1.5"      class="text uk-transition-slide-bottom skin-link"
                link="${window.location.origin}${link}" uk-tooltip="Copy link"></span><br>` : ""}

                <span uk-icon="icon:file-edit;ratio:1.5" class="text uk-transition-slide-bottom skin-edit"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" ${skinObject.public ? "skin-public='true'" : ""} 
                        uk-tooltip="Edit"></span><br>

                <span uk-icon="icon:trash;ratio:1.5"     class="text uk-transition-slide-bottom skin-delete"
                        skin-id="${skinObject.skinID}" skin-name="${skinObject.skinName}" uk-tooltip="Delete"></span>
            </div>
        </div>
    </div>`;
}

const escapeHtml = unsafe => unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");

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

module.exports = new class Pager {

    constructor() {
        this.element = $("#pager");
        this.page = 0;
        this.copyEl = document.getElementById("copy");
    }

    /** @param {ClientSkin[]} skins */
    async viewMySkins(skins, page, direction = "up") {
        
        this.page = page = page == undefined ? this.page : page;
        let skinsInView = skins.slice(PAGE_LIMIT * page, PAGE_LIMIT * (page + 1));
        let skinsHTML = skinsInView.map(createMySkinPanel).join("");
        let emptySkinsHTML = emptySkinPanel.repeat(PAGE_LIMIT - skinsInView.length);

        let panel = $("#my-skins");

        await new Promise(resolve => {
            panel.hide("slide", { direction: 
                direction == "left" ? "right" : "left" }, 500, resolve);
        });
    
        panel.children().remove();
        panel.append($(skinsHTML + emptySkinsHTML));
        
        requestAnimationFrame(() => {
            panel.show("slide", { direction }, 500);
        });
    
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
    
        let copyEl = this.copyEl;
        $(".skin-link").click(function() {

            $(copyEl).val($(this).attr("link"));
            $(copyEl).text($(this).attr("link"));
            
            if (copyText(copyEl))
                Prompt.copied($(copyEl).val());
            else
                Prompt.copyFail($(copyEl).val());
        });
    
        this.clearView();
        let view = createView({ curr: page, total: Math.ceil(skins.length / 12), min: 5,
            onpage: p => {
                this.viewMySkins(skins, p, p > page ? "right" : "left");
            }
        });

        this.element.append(view);
    }
    
    clearView() {
        this.element.children().remove();
    }
}