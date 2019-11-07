// const top    = (kl, vl) => "┏" + "━".repeat(kl + vl + 5) + "┓";
// const middle = (kl, vl) => "┣" + "━".repeat(kl + vl + 5) + "┫";
// const bottom = (kl, vl) => "┗" + "━".repeat(kl + vl + 5) + "┛";

/** @param {Object.<string, string|number>} obj */
module.exports = obj => {

    let keys = Object.keys(obj);
    
    keys = keys.sort((k1, k2) => ~~(10000 * obj[k2] - 10000 * obj[k1]));
    keys = keys.map(k => k[0].toUpperCase() + k.slice(1).toLowerCase().replace(/_/g, " "));

    let values = Object.values(obj)
        .map(n => isNaN(n) ? String(n) : (n = (n * 100).toFixed(2), 
            String(n).length < 5 ? `${n}  %` : `${n} %`));

    let longestKey   = Math.max(...keys.map(k => k.length));
    let longestValue = Math.max(...values.map(v => v.length));

    keys = keys.map(k => k + " ".repeat(longestKey - k.length));
    values = values.map(v => v + " ".repeat(longestValue - v.length));

    return keys.map((k, i) => k + ": " + values[i]).join("\n");
}