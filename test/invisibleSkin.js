const runner = require("./runner");
const fs = require("fs");
const path = require("path");

runner().then(async app => {
    const dataURL = fs.readFileSync(path.join(__dirname, "./images/imageData.txt"), "utf-8");
    const result = await app.nsfwBot.classify(dataURL);

    console.log(result);
    await app.stop();
});
