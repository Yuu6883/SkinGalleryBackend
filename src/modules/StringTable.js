const top    = (kl, vl) => "┏" + "━".repeat(kl + vl + 5) + "┓";
const middle = (kl, vl) => "┣" + "━".repeat(kl + vl + 5) + "┫";
const bottom = (kl, vl) => "┗" + "━".repeat(kl + vl + 5) + "┛";

/** @param {Object.<string, string|number>} obj */
module.exports = obj => {

    let buffer = obj.data;
    delete obj.data;

    let keys = Object.keys(obj);
    
    keys = keys.sort((k1, k2) => parseFloat(obj[k2]) - parseFloat(obj[k1]));
    keys = keys.map(k => k[0].toUpperCase() + k.slice(1).toLowerCase().replace(/_/g, " "));

    let values = Object.values(obj)
        .map(number => (number * 100).toFixed(2))
        .map(number => String(number).length < 5 ? `${number}  %` : `${number} %`);

    let longestKey   = Math.max(...keys.map(k => k.length));
    let longestValue = Math.max(...values.map(v => v.length));

    keys = keys.map(k => k + " ".repeat(longestKey - k.length));
    values = values.map(v => v + " ".repeat(longestValue - v.length));

    obj.data = buffer;

    return keys.map((k, i) => k + ": " + values[i]).join("\n");
}