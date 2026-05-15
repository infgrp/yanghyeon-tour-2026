/**
 * 모든 가입자의 Firebase Auth Custom Claims를 Firestore /users.role과 동기화한다.
 *
 * 사용 시점:
 *   - onUserCreated Cloud Function이 배포되지 않은 환경에서
 *     신규 가입자에게 token.role이 없어 firestore.rules 권한 체크가
 *     실패할 때.
 *   - Blaze 업그레이드 후 onUserCreated 가 동작하면 이 스크립트는 불필요.
 *
 * 사용법:
 *   node scripts/sync-roles.js
 *
 * 동작:
 *   1) /users 컬렉션의 모든 문서를 순회
 *   2) 각 사용자의 Custom Claims.role 이 users.role 과 다르면 갱신
 *   3) 결과 요약 출력
 */

const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.resolve(process.cwd(), "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const auth = admin.auth();

(async () => {
  const snap = await db.collection("users").get();
  let synced = 0, alreadyOk = 0, notFound = 0, failed = 0;

  for (const doc of snap.docs) {
    const uid = doc.id;
    const role = doc.data().role;
    if (!role) {
      console.warn(`- ${uid}: role 필드가 비어있음 — skip`);
      continue;
    }

    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch {
      console.warn(`- ${uid} (role=${role}): Firebase Auth 계정이 없음 — skip`);
      notFound++;
      continue;
    }

    const claims = userRecord.customClaims || {};
    if (claims.role === role) {
      alreadyOk++;
      continue;
    }

    try {
      await auth.setCustomUserClaims(uid, { role });
      const email = userRecord.email || "(no email)";
      const before = claims.role || "(none)";
      console.log(`✓ ${email} (uid=${uid}) : ${before} → ${role}`);
      synced++;
    } catch (err) {
      console.error(`✗ ${uid}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n완료: 동기화 ${synced}건, 이미 일치 ${alreadyOk}건, Auth 없음 ${notFound}건, 실패 ${failed}건`);
  if (synced > 0) {
    console.log("→ 변경된 사용자가 재로그인하면 새 권한이 즉시 적용됩니다.");
    console.log("  (이미 로그인 상태라면 최대 1시간 후 또는 로그아웃 후 재로그인 시 반영)");
  }
  process.exit(0);
})().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
