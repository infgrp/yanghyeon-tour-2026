/**
 * 지정된 사용자의 Firebase Auth 계정 + Firestore users 문서를 삭제한다.
 * 단, students.uid 에 매핑된 primary 사용자라면 거부 (실수 방지).
 *
 * 사용법:
 *   node scripts/delete-user.js <email-or-uid> [<email-or-uid> ...]
 *
 * 동작:
 *   1) 대상 uid 식별
 *   2) students 컬렉션에서 이 uid 가 사용 중인 doc 있는지 확인
 *      → 있으면 거부 (다른 사용자에 의해 도용 가능성, 별도 처리 필요)
 *   3) /users/{uid} 문서 삭제
 *   4) Firebase Auth 계정 삭제
 *
 * 채팅방 멤버 정리:
 *   chat_rooms.members 배열에는 남아있을 수 있음 (별도 처리 필요)
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
  console.error("사용법: node scripts/delete-user.js <email-or-uid> [<email-or-uid> ...]");
  process.exit(1);
}

async function deleteOne(identifier) {
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

  // students.uid 에 primary 로 매핑된 경우 거부
  const inUseSnap = await db.collection("students").where("uid", "==", uid).get();
  if (!inUseSnap.empty) {
    const ids = inUseSnap.docs.map((d) => d.id).join(", ");
    throw new Error(`이 사용자가 students.uid 의 primary 입니다 (${ids}) — 삭제 거부`);
  }

  // 1) Firestore /users 문서 삭제
  await db.doc(`users/${uid}`).delete().catch(() => {});

  // 2) Auth 계정 삭제
  await auth.deleteUser(uid);

  console.log(`✓ ${email} (uid=${uid}) 삭제 완료`);
}

(async () => {
  let ok = 0, failed = 0;
  for (const t of targets) {
    try {
      await deleteOne(t);
      ok++;
    } catch (err) {
      console.error(`✗ ${t}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\n완료: 성공 ${ok}건, 실패 ${failed}건`);
  process.exit(failed > 0 ? 1 : 0);
})();
