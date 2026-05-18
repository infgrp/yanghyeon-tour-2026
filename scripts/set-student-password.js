/**
 * 관리자가 학생의 비밀번호를 즉시 새 값으로 설정한다.
 * (학생이 본인 이메일을 못 보는 경우 사용. 클라이언트의 재설정 이메일 발송이
 *  안 통할 때 fallback.)
 *
 * 사용법:
 *   node scripts/set-student-password.js <학번-or-email> [새-비밀번호]
 *
 * 예시:
 *   node scripts/set-student-password.js G1-C5-N5 newpw1234
 *   node scripts/set-student-password.js yunchan264@gmail.com TempPass!1
 *   node scripts/set-student-password.js G1-C5-N5
 *     (비밀번호 생략 시 8자리 랜덤 영문+숫자 자동 생성 후 콘솔에 출력)
 *
 * 출력: 적용된 새 비밀번호 (사용자에게 안전한 채널로 전달)
 *
 * 주의:
 *   학생/교사 모두에게 동작. 학생만 강제하려면 role 검사 추가 가능.
 */

const path = require("path");
const admin = require("firebase-admin");
const sa = require(path.resolve(process.cwd(), "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const auth = admin.auth();

function randomPassword(len = 8) {
  // 모호한 글자 (0/O, l/1) 제외
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function resolveUid(identifier) {
  // 이메일 형식
  if (identifier.includes("@")) {
    const u = await auth.getUserByEmail(identifier);
    return { uid: u.uid, email: u.email };
  }
  // 학번 형식 (G{학년}-C{반}-N{번호})
  if (/^G\d+-C\d+-N\d+$/i.test(identifier)) {
    const sDoc = await db.doc(`students/${identifier.toUpperCase()}`).get();
    if (!sDoc.exists) throw new Error(`학번 ${identifier} 의 학생을 찾을 수 없습니다.`);
    const uid = sDoc.data().uid;
    if (!uid) throw new Error(`${identifier} 은(는) 아직 가입하지 않았습니다.`);
    const u = await auth.getUser(uid);
    return { uid, email: u.email };
  }
  // 그 외엔 uid 로 직접 시도
  const u = await auth.getUser(identifier);
  return { uid: u.uid, email: u.email };
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("사용법: node scripts/set-student-password.js <학번-or-email> [새-비밀번호]");
    process.exit(1);
  }
  const identifier = args[0];
  const newPassword = args[1] || randomPassword(8);

  if (newPassword.length < 6) {
    console.error("비밀번호는 6자 이상이어야 합니다.");
    process.exit(1);
  }

  let info;
  try {
    info = await resolveUid(identifier);
  } catch (err) {
    console.error("✗", err.message);
    process.exit(1);
  }

  await auth.updateUser(info.uid, { password: newPassword });

  console.log("\n=== 비밀번호 변경 완료 ===");
  console.log(`  대상: ${info.email ?? "(no email)"}  uid=${info.uid}`);
  console.log(`  새 비밀번호: ${newPassword}`);
  console.log("\n→ 학생에게 안전한 채널(대면·문자 등)로 전달하고,");
  console.log("  학생이 로그인 후 즉시 변경하도록 안내하세요.");
  process.exit(0);
})().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
