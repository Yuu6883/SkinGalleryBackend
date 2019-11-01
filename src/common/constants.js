/**
 * @description Shared commonly between server and client
 */
const SKIN_ID_BYTES = 6;
const SKIN_NAME_BYTES = 32;
const SKIN_TAG_BYTES = 8
const SKIN_TAG_LENGTH = 64;
const FAV_BYTES = 2;
const TIME_BYTES = 4;
const DISCORD_ID_BYTES = 8;
const TIME_0 = 1546243200000;

const BYTES_PER_SKIN = SKIN_ID_BYTES + SKIN_NAME_BYTES + SKIN_TAG_BYTES +
    FAV_BYTES + TIME_BYTES + DISCORD_ID_BYTES;

const TAGS = ["agar", "people", "nature", "other", "anime"];

module.exports = {
    TIME_0,
    TAGS,
    SKIN_ID_BYTES,
    SKIN_NAME_BYTES,
    SKIN_TAG_BYTES,
    SKIN_TAG_LENGTH,
    FAV_BYTES,
    TIME_BYTES,
    DISCORD_ID_BYTES,
    BYTES_PER_SKIN
}