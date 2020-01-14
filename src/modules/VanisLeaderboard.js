const fetch = require("node-fetch");
const { RichEmbed } = require("discord.js");
const END_POINT = "https://vanis.io/api/top/";

/** 
 * @param {import("discord.js").Message} message 
 * @param {Number} top
 */
module.exports = async function (message, top) {

    try {
        let res = await fetch(END_POINT + top);
        let json = await res.json();
        let result = "";

        for (let rank in json) {
            let item = json[rank];
            let string = `${~~rank + 1}. **${item.discord_name}**: ${item.xp} xp\n`;
            if (result.length + string.length > 2000) {
                let embed = new RichEmbed()
                    .setTitle(`Vanis.io No Life Losers Top ${top}`)
                    .setDescription(result);
                await message.channel.send(embed);
                result = string;
            } else if (rank === json.length - 1) {
                result += string;
                let embed = new RichEmbed()
                    .setTitle(`Vanis.io No Life Losers Top ${top}`)
                    .setDescription(result);
                await message.channel.send(embed);
            } else {
                result += string;
            }
        }

    } catch (e) {
        console.error(e);
        message.channel.send("Something went wrong.");
    }

}