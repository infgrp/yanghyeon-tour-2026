/**
 * admin 권한을 회수하고 teacher 로 되돌린다.
 *
 * 사용법:
 *   node scripts/revoke-admin.js <email-or-uid> [<email-or-uid> ...]
 *
 * 동작:
 *   1) Firebase Auth Custom Claims를 role=teacher 로 변경
 *   2) Firestore /users/{uid}.role 을 "teacher" 로 업데이트
 */

const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.resolve(process.cwd(), "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const auth = admin.auth();

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("사용법: node scripts/revoke-admin.js <email-or-uid> [<email-or-uid> ...]");
  process.exit(1);
}

async function revoke(identifier) {
  let userRecord;
  try {
    if (identifier.includes("@")) {
      userRecord = await auth.getUserByEmail(identifier);
    } else {
      userRecord = await auth.getUser(identifier);
    }
  } catch (err) {
    throw new Error(`사용자를 찾을 수 없습니다 (${identifier}): ${err.message}`);
  }

  const uid = userRecord.uid;
  const email = userRecord.email || "(no email)";

  await auth.setCustomUserClaims(uid, { role: "teacher" });
  await db.doc(`users/${uid}`).set({ role: "teacher" }, { merge: true });

  console.log(`✓ ${email} (uid=${uid}) → teacher 로 되돌림 완료`);
}

(async () => {
  let ok = 0, failed = 0;
  for (const t of targets) {
    try {
      await revoke(t);
      ok++;
    } catch (err) {
      console.error(`✗ ${t}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\n완료: 성공 ${ok}건, 실패 ${failed}건`);
  process.exit(failed > 0 ? 1 : 0);
})();
