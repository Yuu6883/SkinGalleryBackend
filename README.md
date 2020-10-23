# Skin System For Ogar Projects

## Installation

CLI entry point: `node cli/index.js`
Programmatic entry point: `src/app.js` exports class `SkinGallery`

This reposity only contains the backend for the system; the frontend is integrated as a submodule in `frontend_modules/` so you need `git submodule update --init` aftering cloning or `--recursive` in the clone command to download the frontend.

Nginx and MongoDB is also required for this project. Samples of nginx config are in `nginx.conf` (fpr linux production environment) or `win.nginx.conf` (for windows developement environment)

## Endpoint Documentation

All the endpoint modules are in `src/api` and they are loaded "dynamically".
 
Notable endpoints:
1. `POST /api/skin/:skinName`
 * 2 MB upload limit (client is expected to have a 512x512 image buffer in the payload)
 * An interval will check the reactions on the pending messages. (Must need **\[CONFIGURABLE\]** checkmark/cross reactions to approve/deny). If approved, move the image to public folder, update record in DB; if denied, delete image, update record in DB. Both ways will inform the user on Discord with DMs (or fallback to a default channel or no action).
    * User shall have **\[CONFIGURABLE\]** slots for skins (Include approved and pending). OR PAY ME TO GET EXTRA SLOT.
2. `PUT /api/skin/:id?name=newSkinName` to edit skin name. 
3. `DELETE /api/skin/:id` to delete a skin by its ID.
4. `GET /api/skins/[@me|user_id]` to get a json of skins owned by someone and their status.
5. `GET /public?page=[number]&sort=[-time|time|fav]` to get buffer data of **\[CONFIGURABLE\]** number of public skins.

Nginx public directories:
1. `/s/{ID}` (visible to everyone).
2. `/p/{ID}` (with credentials, passed to node).
3. `/d/{HASH}` for a deleted skin (for referencing purpose)

# Bot Documentation
A discord bot is used since we can't trust user uploaded content and need to review it. If `disableAutoApprove` field in config is `false`, user-uploaded image will go through a nsfw-detection neural network (weights and bias fills are in `nsfw_model`). The detection process is seperated from the webserver process for since it uses lots of CPU power and nodejs is single threaded. Link to the model: https://github.com/GantMan/nsfw_model


