const admin = require("firebase-admin");

if (process.argv[2] !== "--confirm-reset-ninu-arcade") {
  console.error("Refusing to run without the explicit confirmation flag.");
  console.error("Usage: node tools/reset-firebase.cjs --confirm-reset-ninu-arcade");
  process.exit(1);
}

admin.initializeApp({ databaseURL: "https://arlecchino-artifact-simulator-default-rtdb.asia-southeast1.firebasedatabase.app" });

(async () => {
  try {
    await admin.database().ref("/").set(null);
    console.log("Realtime Database cleared.");
    console.log("Firebase Authentication users are separate and were NOT deleted.");
  } catch (error) {
    console.error("Database reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
})();
