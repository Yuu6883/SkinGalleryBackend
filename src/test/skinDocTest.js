const app = require("../../cli/index");
const tests = 5;

app.on("ready", async () => {

    let ownerID = "lalalalala";
    let logger = app.logger;

    // Create test skins
    logger.test(`Creating ${tests} test skin`);
    for (let i = 0; i < tests; i++)
        await app.skins.create(ownerID, `new_skin_${i + 1}`);

    // Count document
    let count = await app.skins.count(ownerID);
    logger.test(`Skin count is ${count}`);

    // Log all skins
    let skins = await app.skins.findByOwnerID(ownerID);
    console.log(skins);
    
    logger.test("Approving first skin");
    let succeed = await app.skins.approve(skins[0].skinID);
    logger.test(succeed ? "Skin approved" : "Failed to approve skin");

    logger.test("Rejecting second skin");
    succeed = await app.skins.reject(skins[1].skinID);
    logger.test(succeed ? "Skin rejected" : "Failed to reject skin");

    logger.test("Editing third skin name to big_boobs");
    succeed = await app.skins.editSkinName(skins[2].skinID, "big_boobs");
    logger.test(succeed ? "Skin name edit success" : "Failed to edit skin name");

    // Log all skins again
    skins = await app.skins.findByOwnerID(ownerID);
    console.log(skins);

    // Count document (should be tests - 1 because 1 is rejected)
    count = await app.skins.count(ownerID);
    logger.test(`Valid skin count is ${count}`);

    logger.test("Deleting all skins");
    await app.skins.dropAll();
});