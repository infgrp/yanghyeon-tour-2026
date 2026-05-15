/**
 * 교사에게 admin (관리자) 권한을 부여한다.
 *
 * 사용법:
 *   node scripts/set-admin.js <email-or-uid> [<email-or-uid> ...]
 *
 * 예시:
 *   node scripts/set-admin.js head1@yanghyeon.hs.kr
 *   node scripts/set-admin.js head1@yanghyeon.hs.kr head2@yanghyeon.hs.kr
 *   node scripts/set-admin.js abc123xyz456
 *
 * 동작:
 *   1) Firebase Auth Custom Claims에 role=admin 설정
 *   2) Firestore /users/{uid} 문서의 role 필드를 "admin"으로 업데이트
 *   3) 대상 사용자가 다음 로그인(또는 토큰 갱신, 최대 1시간) 시 admin 권한 적용
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
  console.error("사용법: node scripts/set-admin.js <email-or-uid> [<email-or-uid> ...]");
  process.exit(1);
}

async function setAdmin(identifier) {
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

  // 1) Custom Claims 설정 — Firestore rules의 request.auth.token.role 에 반영
  //    기존 claims 가 있다면 보존하지 않고 role 만 재설정 (다른 claim 없으니 OK)
  await auth.setCustomUserClaims(uid, { role: "admin" });

  // 2) /users/{uid} 문서의 role 도 업데이트 (UI 표시용)
  await db.doc(`users/${uid}`).set(
    { role: "admin" },
    { merge: true }
  );

  console.log(`✓ ${email} (uid=${uid}) → admin 으로 설정 완료`);
}

(async () => {
  let ok = 0, failed = 0;
  for (const t of targets) {
    try {
      await setAdmin(t);
      ok++;
    } catch (err) {
      console.error(`✗ ${t}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\n완료: 성공 ${ok}건, 실패 ${failed}건`);
  if (ok > 0) {
    console.log("→ 대상 사용자가 재로그인하면 admin 권한이 즉시 적용됩니다.");
    console.log("  (이미 로그인 상태라면 최대 1시간 후 또는 로그아웃 후 재로그인 시 반영)");
  }
  process.exit(failed > 0 ? 1 : 0);
})();
