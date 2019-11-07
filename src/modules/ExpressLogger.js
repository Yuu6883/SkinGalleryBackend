/**
 * @param {[number, number]} stamp
 */
function getTiming(stamp) {
    const x = process.hrtime(stamp);
    return (x[0] * 1e3 + x[1] / 1e6).toFixed(2);
}

/**
 * @param {import("express").Request} req
 */
function getCaller(req) {
    return `${req.method.toUpperCase()} ${req.path} HTTP/${req.httpVersion} ${req.socket.remoteAddress} ${req.headers["user-agent"]}`;
}

/**
 * @param {import("./Logger")} logger
 * @param {import("express").Request} req
 */
function logInitial(logger, req) {
    // logger.debug(getCaller(req));
}
/**
 * @param {import("./Logger")} logger
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {[number, number]} stamp
 */
function logFinal(logger, req, res, stamp) {
    logger.onAccess(`${getCaller(req)} >> FINAL ${res.statusCode} ${getTiming(stamp)}ms`);
}
/**
 * @param {import("./Logger")} logger
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {[number, number]} stamp
 */
function logPremature(logger, req, res, stamp) {
    logger.onAccess(`${getCaller(req)} >> PREMATURE ${res.statusCode} ${getTiming(stamp)}ms`);
}

/**
 * @param {import("./Logger")} logger
 */
module.exports = (logger) => {
    /**
     * @param {import("express").Request} req
     * @param {import("express").Response} res
     * @param {import("express").NextFunction} next
     */
    const fn = (req, res, next) => {
        const stampStart = process.hrtime();
        logInitial(logger, req);
        req.on("close", () => logPremature(logger, req, res, stampStart));
        res.on("finish", () => logFinal(logger, req, res, stampStart));
        next();
    };
    return fn;
};
