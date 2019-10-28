const TensorFlow = require("@tensorflow/tfjs-node");
const { Canvas, loadImage } = require("canvas");
const NSFW_CLASSES = ["drawing", "hentai", "neutral", "porn", "sexy"];

class NSFWbot {
    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
        this.size = 299;
        this.canvas = new Canvas(299, 299);
        this.ctx = this.canvas.getContext("2d");
    }

    async init() {
        let logger = this.app.logger;

        if (this.model) {
            logger.warn("Failed to init again: NSFW model already loaded");
            return;
        }

        let now = Date.now();
        logger.inform("Loading NSFW model");
        this.model = await TensorFlow.loadLayersModel(TensorFlow.io.fileSystem(__dirname + "/../../nsfw_model/model.json"));
        logger.inform(`NSFW model loaded, time elasped: ${Date.now() - now}ms`);
        
    }

    /**
     * @param {string} src
     * @returns {NSFWPrediction}
     */
    async classify(src) {
        let img = await loadImage(src);

        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.canvas.height);
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.fillStyle = "#a3a3a3";
        this.ctx.fillRect(0, 0, this.size, this.size);
        this.ctx.drawImage(img, 0, 0, this.size, this.size);

        let input = TensorFlow.browser
            .fromPixels(this.canvas, 4)
            .toFloat()

        // let sumRGB = input.sum([0, 1]).div(TensorFlow.scalar((this.size / 2) ** 2 * Math.PI / 255));

        let inputArray = input.reshape([this.size ** 2, 4])
            .arraySync()
            .filter(rgba => (rgba[0] || rgba[1] || rgba[2]) && (rgba[3] === 255));

        input.dispose();

        let stdRGB = TensorFlow.moments(inputArray, 0);

        let mean = stdRGB.mean.cast("int32").arraySync();

        // let std = stdRGB.variance.sqrt().cast("int32").arraySync();

        let testResult = await TensorFlow.tidy(() => 
            this.model.predict(TensorFlow.expandDims(TensorFlow.browser.fromPixels(this.canvas, 3)
                                                 .toFloat()
                                                 .div(TensorFlow.scalar(255)
                                                 ), 0)));

        let resultArray = testResult.arraySync()[0];

        /** @type {NSFWPrediction} */
        let result = resultArray.reduce((prev, curr, index) =>{
            prev[NSFW_CLASSES[index]] = curr;
            return prev;
        }, {});

        // result.avarage_rgb = (mean[0] + mean[1] + mean[2]) / 3;
        result.avarage_color = `rgb(${mean[0]},${mean[1]},${mean[2]})`;
        // result.color_STD = (std[0] + std[1] + std[2]) / 3;
        result.data = this.canvas.toBuffer("image/png");

        return result;
    }

    /**
     * @param {NSFWPrediction} result
     * @returns {SkinStatus}
     */
    nsfwStatus(result) {

        if (result.hentai > this.app.config.nsfwHighThreshold || 
            result.porn > this.app.config.nsfwHighThreshold)
            return "rejected";

        if (result.hentai < this.app.config.nsfwLowThreshold &&
            result.porn < this.app.config.nsfwLowThreshold) {
            delete result.avarage_rgb;
            return "approved";
        }

        delete result.avarage_rgb;
        return "pending";        
    }

}

module.exports = NSFWbot;
