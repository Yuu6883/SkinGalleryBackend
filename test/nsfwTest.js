const runner = require("./runner");
const fs = require("fs");
const path = require("path");

runner().then(async app => {
    const dataURL = fs.readFileSync(path.join(__dirname, "./images/imageData.txt"), "utf-8");
    const result = await app.nsfwBot.classify(dataURL);

    fs.writeFileSync(path.join(__dirname, "./dist/nsfw_test.jpeg"), app.nsfwBot.canvas.toBuffer("image/jpeg"));

    console.log(result);
    await app.stop();
});
