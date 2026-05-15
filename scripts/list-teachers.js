/**
 * 가입된 교사·관리자 목록을 콘솔에 출력한다.
 *
 * 사용법:
 *   node scripts/list-teachers.js
 *
 * 출력 컬럼:
 *   ROLE  UID                            EMAIL                     이름   담임
 */

const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.resolve(process.cwd(), "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const auth = admin.auth();

function pad(s, n) {
  s = String(s ?? "");
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

(async () => {
  const snap = await db.collection("users").get();

  const rows = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.role !== "teacher" && data.role !== "admin") continue;
    let email = "";
    try {
      const u = await auth.getUser(doc.id);
      email = u.email || "";
    } catch {
      email = "(auth 없음)";
    }
    const 담임 = data["담임학년"] && data["담임반"]
      ? `${data["담임학년"]}-${data["담임반"]}`
      : "-";
    rows.push({
      role: data.role,
      uid: doc.id,
      email,
      name: data["이름"] ?? "",
      담임,
    });
  }

  rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    return (a.담임 ?? "").localeCompare(b.담임 ?? "");
  });

  console.log(pad("ROLE", 8) + pad("UID", 30) + pad("EMAIL", 32) + pad("이름", 12) + "담임");
  console.log("-".repeat(90));
  for (const r of rows) {
    console.log(pad(r.role, 8) + pad(r.uid, 30) + pad(r.email, 32) + pad(r.name, 12) + r.담임);
  }
  console.log(`\n총 ${rows.length}명 (admin: ${rows.filter(r => r.role === "admin").length}, teacher: ${rows.filter(r => r.role === "teacher").length})`);
  process.exit(0);
})().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
