const admin = require("firebase-admin");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node tools/set-admin.cjs <email>");
  process.exit(1);
}

admin.initializeApp();

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
    console.log(`Admin claim granted to ${user.email} (${user.uid}).`);
    console.log("Sign out/in again in the arcade to refresh the ID token.");
  } catch (error) {
    console.error("Could not grant admin claim:", error.message);
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
})();
