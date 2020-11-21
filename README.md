# Skin Gallery (Backend) For Ogar Projects
## About This Project
This was the codebase for `skins.vanis.io` but `@Luka` and `@Mid` had to rewrite this for some critical reasons. Now I'm making this open sourced since this is no longer used and I want people to know what I've worked on in my free time. This documentation is more about the **functionalities this project had** instead of **how to run it** (not too sure if it still runs). I don't think anyone should use this anymore, either because Ogar clones are dying or the design flaws in this project. In my opinion, this is a fairly large solo project and I'm surprised it lasted for half a year with almost 100% uptime in a semi-production environment. Due to the popularity of the game, the gallery had about 3k daily active user and 60k total users. There were 193k skins by the end of its lifetime. 

## Problems
This project had a few critial problems on a low budget server
* Limited disk space: since the all the skins are saved as png files on the server, it takes **lots** of space. My VPS had 80GB storage and it ran out after half a year (which is why this project shut down. The devs decided to tell users that a new system will be implemented without migrating old skins, aka purging all the existing skins, since they want a fresh new server without disk filled up with images that's never going to be queried again).
* An active review mod team: the project had about 10 volunteers (include myself in the early days) to just manually review user-uploaded content. Even though there's a nsfw filter/model, we decided to disable auto approve feature to reduce server workload (process gets killed sometimes because of out-of-memory error. Tensorflow.js definitely has memory leak somewhere or node garbage collector doesn't work). It was also because the toxicity nature of Ogar clones community; some malicious users kept uploading nsfw content that bypasses the filter on alts, and therefore 100% manual review was required.
* Discord reliability: bot random disconnects, oauth2 redirect doesn't work, pending queue getting stuck, etc.

## Installation
(**need to have config setup correctly**)

CLI entry point: `node cli/index.js`
Programmatic entry point: `src/app.js` exports class `SkinsApp`

This reposity only contains the backend for the gallery; the frontend is integrated as a submodule in `frontend_modules/` so you need `git submodule update --init` aftering cloning or `--recursive` in the clone command to download the frontend.

Nginx and MongoDB is also required for this project. Samples of nginx config are in `nginx.conf` (fpr linux production environment) or `win.nginx.conf` (for windows developement environment)

## Config
There's insanely long list of configurable values, omitted here but if you want to run the app you need `cli/config.js` which should export an object of type `AppConfig` defined in `global.d.ts`.
To serve the static content of the app, nginx is also required (`nginx.conf`)

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
5. `GET /public?page=[number]&sort=[-time|time|fav]` to get buffer data of **\[CONFIGURABLE\]** number (1 page) of public skins. All the skin records are cached in memory as a buffer; this endpoint is fast since it only involves buffer slicing and no database querying.

There are also login/logout endpoints but omitted here.

Nginx public directories:
1. `/s/{ID}` (visible to everyone).
2. `/p/{ID}` (with credentials, passed to node).
3. `/d/{HASH}` for a deleted skin (for referencing purpose)

## Bot Documentation
A discord bot is used since we can't trust user uploaded content and need to review it. If `disableAutoApprove` field in config is `false`, user-uploaded image will go through a nsfw-detection neural network (weights and bias fills are in `nsfw_model`). The detection process is seperated from the webserver process for since it uses lots of CPU power and nodejs is single threaded. Link to the model: https://github.com/GantMan/nsfw_model

### Admin Commands
(Prefix is configurable, using ! here; Admin is hardcoded in config and not saved in database)
* `!change [fromID] [toID]` change a skin id
* `!delete [skinID]` force delete a skin
* `!mod [userID]` make someone a skin mod
* `!minimod [userID]` make someone a mini mod (can only report skin)
* `!demote [userID]` demote a skin mod/mini mod
* `!ismod [userID]` check if a user is a mod
* `!purge [userID]` force purges a user's skin collection
* `!count` log the count of approved, pending/rejected, and delete skins
* `!size` log the disk space of approved, pending/rejected, and delete skins
* `!eval [code]` eval the code (for hot debugging)
* `!approve` approve all pending skins at once
* `!update` send request to cloudflare to purge serverside cache
* `!clean` clean up pending skin channel (somehow skins get stuck)
* A few more debug commands

### Skin Mod Commands
* `!random` sends random skin url
* `!exit` restart the bot
* `!reject [skinID]` rejected a skin (after it's approved for some reason)
* `!ban [userID]` bans the user from the gallery
* `!unban [userID]` unbans the user from the gallery
* `!list [userID]` list the user's skin collection
* `!render [userID]` render the user's skin collection to a canvas
* `!ownerof [skinID]` shows the owner of a skin
* `!rank` shows the ranked scores of skin mods

### Mini Mod Commands
* `!report [skinID]` reports a skin so mod team can review later
