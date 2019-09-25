const top    = (kl, vl) => "┏" + "━".repeat(kl + vl + 5) + "┓";
const middle = (kl, vl) => "┣" + "━".repeat(kl + vl + 5) + "┫";
const bottom = (kl, vl) => "┗" + "━".repeat(kl + vl + 5) + "┛";

/** @param {Object.<string, string|number>} obj */
module.exports = obj => {

    let buffer = obj.data;
    delete obj.data;

    let keys = Object.keys(obj);
    let values = Object.values(obj);

    keys = keys.map(k => k[0].toUpperCase() + k.slice(1).toLowerCase().replace(/_/g, " "));

    let longestKey = Math.max(...keys.map(k => k.length));
    let longestValue = Math.max(...values.map(v => v.length));

    keys = keys.map(k => k + " ".repeat(longestKey - k.length));
    values = values.map(v => v + " ".repeat(longestValue - v.length));

    obj.data = buffer;

    return top(longestKey, longestValue) + "\n" +
           keys.map((k, i) => "┃" + k + ": " + values[i] + "┃\n").join(middle(longestKey, longestValue) + "\n") +
           bottom(longestKey, longestValue);
}