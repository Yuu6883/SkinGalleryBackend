# Skin System For Ogar Projects

CLI entry point: `node cli/index.js`
Programmatic entry point: `src/app.js` exports class `SkinGallery`

## Skin System Documentation
1. `PUT /api/skin/:skinName`
 * An interval will check the reactions on the pending messages. (Must need \[CONFIGURABLE\] checkmark/cross reactions to approve/deny). If approved, move the image to public folder, update record in DB; if denied, delete image, update record in DB. Both ways will inform the user on Discord with DMs (or fallback to a default channel or no action).
    * A user will have \[CONFIGURABLE\] slots for skins (Include approved and pending). OR PAY ME TO GET EXTRA SLOT.
 
2. `DELETE /api/skin/:id` to delete a skin by its ID.
3. `GET /api/skin/@me` to get a json of skin IDs and their status in JSON.
4. `GET /s/{ID}` (visible to everyone).
5. `GET /p/{ID}` (with credentials).
6. `GET /d/{HASH}` for a deleted skin (for referencing purpose)
