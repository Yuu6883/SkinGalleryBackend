# Vanis.io skin system

CLI entry point: `node cli/index.js`
Programmatic entry point: `src/app.js` exports class `VanisSkins`

## Skin System Road Map
1. `POST /api/skin/create` or I suggest `PUT /api/skin` for submitting skin
    * Might need to disable bodyparser for other routes that don't require a body to reduce potential DoS overload server is big request body
    * Rate limit this route to about 3-5 seconds, and limit body size to maximum 1MB
    * After receiving image, load it with node-canvas, check dimension, convert to ImageData and use nsfw.js to classify the submitted skin.
    * If `["hentai","porn"]` fields of the predictions are both less than 20%, approves the skin, write image to public folder, and add record to DB
    * If either field is greater than 20% but less than 70%, send the skin to discord (with spoiler tag along with the predictions), write image to pending folder which is only visible to the submitter or moderator, and add record (with the discord message ID) to DB.
    * If either field is greater than 70%, send warning to client. Do nothing or add warning record to DB (for maybe banning reasons)
    * An interval will check the reactions on the pending messages. (Must need 2 checkmark/cross reactions to approve/deny). If approved, move the image to public folder, update record in DB; if denied, delete image, update record in DB. Both ways will inform the user on Discord with DMs (or fallback to a default channel or no action).
    * A user will have 10 slots for skins (Include approved and pending). OR PAY ME TO GET EXTRA SLOT.
 
2. `DELETE /api/skin?id={ID}` to delete a skin by its ID. If no ID is presented, delete all skins.
3. `GET /api/skin/me` to get a json of skin IDs and their status in JSON.
4. Public folder might be accessed from `GET /s/{ID}` (visible to everyone).
5. Pending folder might be accessed from `GET /p/{ID}` (with credentials).
6. Moderator route is optional since it's supposed to be based on Discord (interaction with bot, but we will see).
7. `POST /api/report?id={ID}` to report a skin which adds to the record in DB. More than 3 record will trigger a review on Discord. Obvious false claims might result in a temp ban.
