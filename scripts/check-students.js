/**
 * students 컬렉션 진단:
 *  - 전체 학생 수
 *  - uid가 채워진 학생 수 (= 가입 완료된 학생)
 *  - users 컬렉션의 student 역할 사용자 중 students.uid 가 빠진 케이스
 *
 * 사용법: node scripts/check-students.js
 */

const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.resolve(process.cwd(), "serviceAccountKey.json"));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

(async () => {
  // 1) students 컬렉션 분석
  const sSnap = await db.collection("students").get();
  let total = 0, joined = 0;
  const joinedList = [];
  sSnap.forEach((doc) => {
    total++;
    const data = doc.data();
    if (data.uid) {
      joined++;
      joinedList.push({ id: doc.id, name: data.이름, uid: data.uid });
    }
  });
  console.log(`[students 컬렉션] 전체 ${total}명 / 가입 ${joined}명`);
  if (joinedList.length > 0) {
    console.log("  가입된 학생:");
    joinedList.forEach((s) => {
      console.log(`    ${s.id}  ${s.name}  uid=${s.uid}`);
    });
  }

  // 2) users 컬렉션의 student 역할 분석
  const uSnap = await db.collection("users").where("role", "==", "student").get();
  console.log(`\n[users 컬렉션] role=student 인 사용자 ${uSnap.size}명`);
  for (const doc of uSnap.docs) {
    const data = doc.data();
    const ref = data.studentRef || "";
    const sid = ref.split("/").pop();
    let mark = "";
    if (sid) {
      const sDoc = await db.doc(`students/${sid}`).get();
      if (!sDoc.exists) mark = " ⚠️ students doc 없음";
      else if (!sDoc.data().uid) mark = " ⚠️ students.uid 비어있음 (불일치)";
      else if (sDoc.data().uid !== doc.id) mark = ` ⚠️ uid 불일치 (students.uid=${sDoc.data().uid})`;
      else mark = " ✓ 정상";
    } else {
      mark = " ⚠️ studentRef 없음";
    }
    console.log(`  uid=${doc.id}  studentRef=${ref}${mark}`);
  }

  process.exit(0);
})().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
