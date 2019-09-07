const app = require("../../cli/index");
const fs = require('fs');

app.on("ready", async () => {

    let dataURL = fs.readFileSync(__dirname + "/images/imageData.txt", "utf-8");

    let result = await app.brain.classify(dataURL);
    
    fs.writeFileSync(__dirname + "/dist/nsfw_test.jpeg", app.brain.canvas.toBuffer("image/jpeg"));

    console.log(result);
});