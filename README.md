# Vanis.io skin system

CLI entry point: `node cli/index.js`
Programmatic entry point: `src/app.js` exports class `VanisSkins`

## Skin System Documentation
1. `PUT /api/skin/:skinName`
    * If `["hentai","porn"]` fields of the predictions are both less than 20%, approves the skin, write image to public folder, and add record to DB
    * If either field is greater than [MagicNumber1] but less than [MagicNumber2], send the skin to discord (with spoiler tag along with the predictions), write image to pending folder which is only visible to the submitter or moderator, and add record (with the discord message ID) to DB.
    * If either field is greater than 70%, send warning to client. Do nothing or add warning record to DB (for maybe banning reasons)
    * An interval will check the reactions on the pending messages. (Must need 2 checkmark/cross reactions to approve/deny). If approved, move the image to public folder, update record in DB; if denied, delete image, update record in DB. Both ways will inform the user on Discord with DMs (or fallback to a default channel or no action).
    * A user will have [10] slots for skins (Include approved and pending). OR PAY ME TO GET EXTRA SLOT.
 
2. `DELETE /api/skin/:id` to delete a skin by its ID.
3. `GET /api/skin/@me` to get a json of skin IDs and their status in JSON.
4. `GET /s/{ID}` (visible to everyone).
5. `GET /p/{ID}` (with credentials).

# TODO

1. `POST /api/report/:id` to report a skin which adds to the record in DB. More than 3 record will trigger a review on Discord. Obvious false claims might result in a temp ban.
2. Discord upload skin command
