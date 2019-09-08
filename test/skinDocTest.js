const runner = require("./runner");
const tests = 5;

runner().then(async app => {
    const ownerID = "0";
    const logger = app.logger;

    // Create test skins
    logger.test(`Creating ${tests} test skin`);
    for (let i = 0; i < tests; i++)
        await app.skins.create(ownerID, `new_skin_${i + 1}`);

    // Count document
    let count = await app.skins.countByOwnerID(ownerID);
    logger.test(`Skin count is ${count}`);

    // Log all skins
    let skins = await app.skins.findByOwnerID(ownerID);
    console.log(skins);

    logger.test("Approving first skin");
    let succeed = await app.skins.setState(skins[0].skinID, "approved");
    logger.test(succeed ? "Skin approved" : "Failed to approve skin");

    logger.test("Rejecting second skin");
    succeed = await app.skins.setState(skins[1].skinID, "rejected");
    logger.test(succeed ? "Skin rejected" : "Failed to reject skin");

    logger.test("Editing third skin name to big_boobs");
    succeed = await app.skins.editName(skins[2].skinID, "big_boobs");
    logger.test(succeed ? "Skin name edit success" : "Failed to edit skin name");

    // Log all skins again
    skins = await app.skins.findByOwnerID(ownerID);
    console.log(skins);

    // Count document (should be tests - 1 because 1 is rejected)
    count = await app.skins.countByOwnerID(ownerID);
    logger.test(`Valid skin count is ${count}`);

    logger.test("Deleting all skins");
    logger.test(`Deleted ${(await app.skins.dropAll()).deletedCount} skins`);
    await app.stop();
});
