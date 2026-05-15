/**
 * users 컬렉션의 student 역할 사용자 정보를 기준으로
 * students.{학번}.uid 필드를 채워주는 backfill 스크립트.
 *
 * 충돌 처리: 같은 학번 doc 에 여러 user 가 매핑된 경우
 *   1) 기본: 가장 일찍 createdAt 인 user 의 uid 만 적용
 *   2) 나머지는 경고 + 상세 로그
 *
 * 사용법:
 *   node scripts/sync-student-uids.js              # dry-run (변경 없이 출력만)
 *   node scripts/sync-student-uids.js --apply      # 실제 적용
 */

const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.resolve(process.cwd(), "serviceAccountKey.json"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");

(async () => {
  const uSnap = await db.collection("users").where("role", "==", "student").get();

  // 학번 → [{ uid, createdAt }, ...]
  const byStudentId = new Map();
  uSnap.forEach((doc) => {
    const data = doc.data();
    const ref = data.studentRef || "";
    const sid = ref.split("/").pop();
    if (!sid) return;
    if (!byStudentId.has(sid)) byStudentId.set(sid, []);
    byStudentId.get(sid).push({
      uid: doc.id,
      createdAt: data.createdAt?.toMillis?.() ?? 0,
    });
  });

  let toUpdate = 0, conflicts = 0, alreadyOk = 0, missing = 0;

  for (const [sid, users] of byStudentId) {
    const sDoc = await db.doc(`students/${sid}`).get();
    if (!sDoc.exists) {
      console.warn(`⚠️  ${sid}: students doc 없음 (uid 후보 ${users.map(u => u.uid).join(", ")})`);
      missing++;
      continue;
    }
    const currentUid = sDoc.data().uid;

    // 가장 일찍 createdAt 인 user 선택
    users.sort((a, b) => a.createdAt - b.createdAt);
    const primary = users[0];
    const losers = users.slice(1);

    if (currentUid === primary.uid) {
      alreadyOk++;
      continue;
    }

    if (losers.length > 0) {
      conflicts++;
      console.warn(`⚠️  ${sid}: 같은 학번에 ${users.length}명 가입`);
      console.warn(`    primary (적용): ${primary.uid}`);
      losers.forEach((u) => console.warn(`    충돌 (보존): ${u.uid}`));
    }

    if (APPLY) {
      await db.doc(`students/${sid}`).update({ uid: primary.uid });
      console.log(`✓ ${sid} → uid=${primary.uid} 설정 완료`);
    } else {
      console.log(`(dry) ${sid} → uid=${primary.uid} 설정 예정`);
    }
    toUpdate++;
  }

  console.log(`\n${APPLY ? "[APPLIED]" : "[DRY-RUN]"} 적용 ${toUpdate}건, 이미 일치 ${alreadyOk}건, 충돌 ${conflicts}건, students 누락 ${missing}건`);
  if (!APPLY && toUpdate > 0) {
    console.log("→ 실제 적용하려면 다시 실행: node scripts/sync-student-uids.js --apply");
  }
  process.exit(0);
})().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
