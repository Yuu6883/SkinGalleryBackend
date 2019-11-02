const fs = require("fs");
const configPath = `${__dirname}/nsfw-config.json`;

if (!fs.existsSync(configPath))
    fs.writeFileSync(configPath, `{"LOW":0.1,"HIGH":1}`);

const { LOW, HIGH } = require("./nsfw-config.json");

/**
 * @param {NSFWPrediction} result
 * @returns {SkinStatus}
 */
module.exports = result => {

    if (result.hentai > HIGH || 
        result.porn   > HIGH)
        return "rejected";

    if (result.hentai < LOW &&
        result.porn   < LOW &&
        result.sexy   < LOW * 2) {
        delete result.avarage_rgb;
        return "approved";
    }

    delete result.avarage_rgb;
    return "pending";        
}
