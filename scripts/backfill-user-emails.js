/**
 * users 컬렉션의 각 문서에 Firebase Auth 의 email 을 backfill 한다.
 *
 * 사용 시점:
 *   이전 가입자는 users 문서에 email 필드가 없어, 담임이 학번으로
 *   학생 이메일을 조회할 수 없는 경우.
 *
 * 사용법:
 *   node scripts/backfill-user-emails.js
 *
 * 동작:
 *   1) /users 컬렉션 전체 순회
 *   2) Auth 계정에서 email 가져와 users.email 갱신 (이미 있으면 skip)
 *   3) Auth 계정이 없는 경우 경고
 */

const path = require("path");
const admin = require("firebase-admin");

const sa = require(path.resolve(process.cwd(), "serviceAccountKey.json"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();
const auth = admin.auth();

(async () => {
  const snap = await db.collection("users").get();
  let updated = 0, alreadyOk = 0, notFound = 0;

  for (const doc of snap.docs) {
    const uid = doc.id;
    const data = doc.data();

    if (data.email) {
      alreadyOk++;
      continue;
    }

    let user;
    try {
      user = await auth.getUser(uid);
    } catch {
      console.warn(`- ${uid}: Auth 계정 없음 — skip`);
      notFound++;
      continue;
    }

    if (!user.email) {
      console.warn(`- ${uid}: Auth.email 비어있음 — skip`);
      notFound++;
      continue;
    }

    await db.doc(`users/${uid}`).set({ email: user.email }, { merge: true });
    console.log(`✓ ${user.email} (uid=${uid}) email 저장 완료`);
    updated++;
  }

  console.log(`\n완료: 갱신 ${updated}건, 이미 보유 ${alreadyOk}건, Auth 없음 ${notFound}건`);
  process.exit(0);
})().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
