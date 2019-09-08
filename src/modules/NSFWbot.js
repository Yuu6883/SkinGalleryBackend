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
        this.init();
    }

    async init() {
        let logger = this.app.logger;

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

        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.drawImage(img, 0, 0, this.size, this.size);

        let input = TensorFlow.browser
            .fromPixels(this.canvas)
            .toFloat()
            .div(TensorFlow.scalar(255));

        let testResult = await TensorFlow.tidy(() => this.model.predict(TensorFlow.expandDims(input, 0)));

        let resultArray = testResult.arraySync()[0];

        let result = resultArray.reduce((prev, curr, index) =>{
            prev[NSFW_CLASSES[index]] = curr;
            return prev;
        }, {});

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
            result.porn < this.app.config.nsfwLowThreshold)
            return "approved";

        return "pending";        
    }

}

module.exports = NSFWbot;
