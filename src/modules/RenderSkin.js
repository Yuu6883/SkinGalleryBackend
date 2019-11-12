const { Canvas, loadImage } = require("canvas");
const { SKIN_STATIC, PENDING_SKIN_STATIC } = require("../constant");

const SKIN_PER_ROW = 6;

const MARGIN = 30;
const PADDING = 15;
const TEXT_HEIGHT = 40;
const IMAGE_LENGTH = 128;
const TITLE_HEIGHT = 100;
const STATUS_WIDTH = 56;
const STATUS_HEIGHT = 18;

const CARD_HEIGHT = 2 * PADDING + IMAGE_LENGTH + TEXT_HEIGHT;
const CARD_WIDTH  = PADDING + IMAGE_LENGTH + PADDING;
const CANVAS_WIDTH = SKIN_PER_ROW * CARD_WIDTH + (SKIN_PER_ROW + 1) * MARGIN;

const BACKGROUND_COLOR = "#04070b";
const CARD_COLOR = "#172535";

const STATUS_COLOR = {"approved":"#32d296","pending":"#faa05a","rejected":"#f0506e"};

/** @type {import("canvas").Image} */
let LOGO_IMG;
/** @type {import("canvas").Image} */
let IMG_404;

let logoPromise = loadImage(`${SKIN_STATIC}/../web/assets/img/logo-grey.png`)
    .then(img => LOGO_IMG = img);

let notfoundPromise = loadImage(`${SKIN_STATIC}/404.png`)
    .then(img => IMG_404 = img);

/** @type {{ userDoc: UserDocument, skinDocs: SkinDocument[], resolve: Function }[]} */
let renderQueue = [];

/** 
 * @param {UserDocument} userDoc
 * @param {SkinDocument[]} skinDocs
 * @returns {Promise<Buffer>}
 */
const render = (userDoc, skinDocs) => new Promise(async resolve => {

    if (!LOGO_IMG) await logoPromise;
    if (!IMG_404)  await notfoundPromise;

    renderQueue.push({ userDoc, skinDocs, resolve });
    if (renderQueue.length > 1) return;
    renderQueue.unshift();

    let getPath = doc => `${doc.status == "approved" ? 
        SKIN_STATIC : PENDING_SKIN_STATIC}/${doc.skinID}.png`;

    let results = await Promise.all(skinDocs.map(async doc => 
        ({
            image: await loadImage(getPath(doc)).catch(_ => IMG_404),
            name: doc.skinName,
            status: doc.status,
            fav:  doc.favorites,
        })));

    let rows = Math.ceil(results.length / SKIN_PER_ROW);
    let height = TITLE_HEIGHT + rows * CARD_HEIGHT + rows * MARGIN;
    let canvas = new Canvas(CANVAS_WIDTH, height);
    let ctx = canvas.getContext("2d");

    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let username = userDoc.cacheInfo.get("username");
    let dis = userDoc.cacheInfo.get("discriminator");
    let title = "";

    // Draw text title
    ctx.fillStyle = "#ffffff";

    if (username && dis) {
        title = `${username}#${dis}'s skin collection`;
    } else {
        title = `User${userDoc.id}'s skin collection`;
    }

    ctx.font = "48px Sans";
    ctx.textAlign = "center";
    ctx.fillText(title, CANVAS_WIDTH / 2, 2 * TITLE_HEIGHT / 3);
    
    for (let i = 0; i < rows * SKIN_PER_ROW; i++) {

        let row = ~~(i / SKIN_PER_ROW);
        let col = i % SKIN_PER_ROW;

        let { image, name, status, fav } = results[i] || {};

        // Draw card background
        ctx.fillStyle = CARD_COLOR;

        let x = MARGIN + col * (CARD_WIDTH + MARGIN);
        let y = TITLE_HEIGHT + row * (CARD_HEIGHT + MARGIN);

        ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);

        ctx.save();
        // Draw image
        ctx.beginPath();
        ctx.arc(x + PADDING + IMAGE_LENGTH / 2, y + PADDING + IMAGE_LENGTH / 2,
            IMAGE_LENGTH / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (!image) {
            ctx.globalAlpha = 0.1;
            ctx.drawImage(LOGO_IMG, x + PADDING, 
                y + PADDING, IMAGE_LENGTH, IMAGE_LENGTH);
            ctx.globalAlpha = 1;
            ctx.restore();
            continue;
        }

        ctx.drawImage(image, x + PADDING, y + PADDING,
            IMAGE_LENGTH, IMAGE_LENGTH);
        ctx.restore();

        // Draw Text
        ctx.font = "18px Sans";

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(name, x + PADDING + IMAGE_LENGTH / 2, 
            y + 2 * PADDING + IMAGE_LENGTH + TEXT_HEIGHT / 4, IMAGE_LENGTH);

        // Star text
        ctx.textAlign = "left";
        ctx.font = "14px Sans";
        ctx.fillText(`Stars: ${fav}`, x + PADDING, 
            y + 2 * PADDING + IMAGE_LENGTH + 3 * TEXT_HEIGHT / 4);

        // Draw status
        ctx.fillStyle = STATUS_COLOR[status];
        ctx.fillRect(x + PADDING + IMAGE_LENGTH - STATUS_WIDTH + PADDING / 2,
            y + PADDING / 2, STATUS_WIDTH, STATUS_HEIGHT);

        // Status text
        ctx.font = "12px Sans";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(status, x + PADDING + IMAGE_LENGTH + PADDING / 2 - STATUS_WIDTH / 2,
            y + PADDING / 2 + STATUS_HEIGHT / 2 + 3);
    }

    resolve(canvas.toBuffer("image/png"));
    
    if (renderQueue.length) {
        let task = renderQueue.shift();
        setImmediate(() => 
            render(task.userDoc, task.skinDocs)
                .then(task.resolve));
    }
});

module.exports = render;