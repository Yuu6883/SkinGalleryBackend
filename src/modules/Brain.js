const tf = require("@tensorflow/tfjs-node");
const { Canvas, loadImage } = require("canvas");
const express = require("express");
const NSFW_CLASSES = ['drawing', 'hentai', 'neutral', 'porn', 'sexy'];

/** @typedef {{ drawing: number, hentai: number, neutral: number, porn: number, sexy: number }} NSFWResult */

class Brain {

    /**
     * @param {import("../app")} app
     */
    constructor(app) {
        this.app = app;
        // this.selfPort = 3001;
        this.ready = false;
        this.size = 299;
        this.canvas = new Canvas(299, 299);
        this.ctx = this.canvas.getContext("2d");
        this.init();
    }

    async init() {
        let logger = this.app.logger;

        let now = Date.now();
        logger.inform("Loading NSFW model");
        this.model = await tf.loadLayersModel(tf.io.fileSystem(__dirname + "/../../nsfw_model/model.json"));
        logger.inform(`NSFW model loaded, time elasped: ${Date.now() - now}ms`);

        // /** @type {tf.Tensor<tf.Rank>} */
        // let testResult = await tf.tidy(() => this.model.predict(tf.zeros([1, this.size, this.size, 3])));

        // let resultArray = testResult.arraySync()[0];
        
        // let result = resultArray.reduce((prev, curr, index) =>{
        //     prev[NSFW_CLASSES[index]] = curr;
        //     return prev;
        // }, {});
    }

    /** 
     * @param {string} src
     * @returns {NSFWResult}
     */
    async classify(src) {
        let img = await loadImage(src);

        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.drawImage(img, 0, 0, this.size, this.size);

        let input = tf.browser
            .fromPixels(this.canvas)
            .toFloat()
            .div(tf.scalar(255));

        let testResult = await tf.tidy(() => this.model.predict(tf.expandDims(input, 0)));

        let resultArray = testResult.arraySync()[0];
        
        let result = resultArray.reduce((prev, curr, index) =>{
            prev[NSFW_CLASSES[index]] = curr;
            return prev;
        }, {});

        return result;
    }

}

module.exports = Brain;