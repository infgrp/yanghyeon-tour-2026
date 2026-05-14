/**
 * 관리자 Custom Claims 설정 스크립트
 *
 * 사용법:
 *   npx ts-node -r tsconfig-paths/register scripts/set-admin.ts <uid>
 *
 * 또는 (firebase-admin 직접):
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   npx ts-node scripts/set-admin.ts <uid>
 */

import * as admin from "firebase-admin";
import * as path from "path";

const uid = process.argv[2];
if (!uid) {
  console.error("사용법: npx ts-node scripts/set-admin.ts <uid>");
  process.exit(1);
}

// serviceAccountKey.json을 프로젝트 루트에 배치해야 합니다.
const serviceAccount = path.resolve(process.cwd(), "serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function setAdmin(targetUid: string) {
  console.log(`Setting admin claims for uid: ${targetUid}`);

  // Custom Claims 설정
  await auth.setCustomUserClaims(targetUid, { role: "admin" });

  // Firestore /users/{uid} 문서 생성/업데이트
  await db.doc(`users/${targetUid}`).set(
    { uid: targetUid, role: "admin" },
    { merge: true }
  );

  const user = await auth.getUser(targetUid);
  console.log(`✓ Admin 설정 완료: ${user.email ?? targetUid}`);
  console.log("  사용자가 재로그인하면 admin 역할이 적용됩니다.");
}

setAdmin(uid)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("오류:", err);
    process.exit(1);
  });
