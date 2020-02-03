/** @type {import("@tensorflow/tfjs-node")} */
let TensorFlow;
const { Canvas, loadImage } = require("canvas");
const NSFW_CLASSES = ["drawing", "hentai", "neutral", "porn", "sexy"];

class NSFWBot {
    
    /**
     * @param {Number} size 
     */
    constructor() {
        this.size = 0;

        /** @type {import("./Logger")} */
        this.logger = {
            inform: console.log,
            warn:   console.warn,
            debug: () => {}
        };
    }

    async init() {

        if (this.model)
            return (this.logger.warn("Failed to init again: NSFW model already loaded"), this);
            
        let handler;
        try {
            TensorFlow = require("@tensorflow/tfjs-node");
            handler = TensorFlow.io.fileSystem(`${__dirname}/../../nsfw_model/model.json`);
            this.size = 299;
        } catch (_) {
            // Windows have cancer???
            TensorFlow = require("@tensorflow/tfjs");
            // Get rid of a super long and dumb message
            TensorFlow.ENV.set("IS_NODE", false);
            
            handler = "https://nsfwjs.com/quant_nsfw_mobilenet/model.json";
            this.size = 224;
        }

        this.canvas = new Canvas(this.size, this.size);
        this.ctx = this.canvas.getContext("2d");

        let now = Date.now();
        this.logger.inform(`Loading NSFW model(${this.size})`);
        this.model = await TensorFlow.loadLayersModel(handler);
        this.logger.inform(`NSFW model loaded, time elasped: ${Date.now() - now}ms`);
        
        return this;
    }

    /**
     * @param {String|Buffer} src
     * @returns {Promise<NSFWPrediction>}
     */
    async classify(src) {
        let img = await loadImage(src);

        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.canvas.height);
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.fillStyle = "#a3a3a3";
        this.ctx.fillRect(0, 0, this.size, this.size);
        this.ctx.drawImage(img, 0, 0, this.size, this.size);

        /** @type {number[]} */
        let mean;

        // let std = stdRGB.variance.sqrt().cast("int32").arraySync();

        let resultArray = await TensorFlow.tidy(() => {            
            let input = TensorFlow.browser
                .fromPixels(this.canvas, 4)
                .toFloat()

            let inputArray = input.reshape([this.size ** 2, 4])
                .arraySync()
                .filter(rgba => (rgba[0] || rgba[1] || rgba[2]) && (rgba[3] === 255));
            let stdRGB = TensorFlow.moments(inputArray, 0);
            mean = stdRGB.mean.cast("int32").arraySync();
            
            return this.model.predict(
                TensorFlow.expandDims(
                    TensorFlow.browser.fromPixels(this.canvas, 3)
                                      .toFloat()
                                      .div(TensorFlow.scalar(255)), 0))
                             .arraySync()[0];
        });

        /** @type {NSFWPrediction} */
        let result = resultArray.reduce((prev, curr, index) =>{
            prev[NSFW_CLASSES[index]] = curr;
            return prev;
        }, {});

        result.avarage_color = `rgb(${mean[0]},${mean[1]},${mean[2]})`;

        return result;
    }
}

module.exports = NSFWBot;
