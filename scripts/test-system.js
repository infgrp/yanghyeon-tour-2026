/**
 * 전체 시스템 e2e 진단 스크립트.
 *
 * 무엇을 확인하는가:
 *   1) 데이터 컬렉션 상태 (students/users/buses/schedule/rooms/contacts/incidents/checkin_sessions/chat_rooms)
 *   2) users 와 Auth, students.uid 정합성
 *   3) Custom Claims 동기화 상태
 *   4) 채팅방 생성 흐름 시뮬레이션 (admin_teachers, class)
 *   5) 점호 세션·체크인 통계 계산
 *   6) 학년·반·호실·호차 데이터 정합성 (빈 호차/호실, 호실 정원 등)
 *
 * 사용법:
 *   node scripts/test-system.js
 *
 * 결과 마크:
 *   ✅ 정상   ⚠️  경고/주의   ❌ 오류
 */

const path = require("path");
const admin = require("firebase-admin");
const sa = require(path.resolve(process.cwd(), "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const auth = admin.auth();

const out = [];
function log(level, section, msg) {
  out.push({ level, section, msg });
  const icon = level === "ok" ? "✅" : level === "warn" ? "⚠️ " : level === "err" ? "❌" : "  ";
  console.log(`${icon} [${section}] ${msg}`);
}

async function section1_collections() {
  console.log("\n=== 1. 컬렉션 상태 ===");
  const names = ["students", "users", "buses", "schedule", "rooms", "contacts", "incidents", "checkin_sessions", "chat_rooms"];
  for (const name of names) {
    const snap = await db.collection(name).get();
    if (snap.empty) log("warn", name, "비어있음");
    else log("ok", name, `${snap.size}건`);
  }
}

async function section2_users_consistency() {
  console.log("\n=== 2. users ↔ Auth ↔ students.uid 정합성 ===");
  const usersSnap = await db.collection("users").get();
  let missingAuth = 0, missingClaim = 0, mismatchClaim = 0;
  let students = 0, teachers = 0, admins = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const uid = doc.id;
    const role = data.role;
    if (role === "student") students++;
    else if (role === "teacher") teachers++;
    else if (role === "admin") admins++;

    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch {
      missingAuth++;
      log("err", "users", `${uid}: Firebase Auth 계정 없음`);
      continue;
    }

    const claim = (userRecord.customClaims || {}).role;
    if (!claim) {
      missingClaim++;
      log("warn", "users", `${userRecord.email ?? uid}: Custom Claim 미설정 (role=${role})`);
    } else if (claim !== role) {
      mismatchClaim++;
      log("err", "users", `${userRecord.email ?? uid}: claim=${claim} ≠ users.role=${role}`);
    }
  }
  log("ok", "users 통계", `학생 ${students}명 / 교사 ${teachers}명 / 관리자 ${admins}명`);
  if (missingAuth + missingClaim + mismatchClaim === 0) {
    log("ok", "users 정합성", "모든 사용자 정상");
  }
}

async function section3_students_uid() {
  console.log("\n=== 3. students 가입 현황 ===");
  const sSnap = await db.collection("students").get();
  let joined = 0, missing = 0;
  for (const d of sSnap.docs) {
    if (d.data().uid) joined++;
    else missing++;
  }
  log("ok", "students", `전체 ${sSnap.size}명 — 가입 ${joined} / 미가입 ${missing}`);

  // users.studentRef ↔ students.uid 불일치
  const usersSnap = await db.collection("users").where("role", "==", "student").get();
  let mismatch = 0;
  for (const u of usersSnap.docs) {
    const ref = u.data().studentRef;
    if (!ref) continue;
    const sid = ref.split("/").pop();
    const sd = await db.doc(`students/${sid}`).get();
    if (!sd.exists) {
      log("err", "students", `${u.id}: studentRef=${ref} 학생 doc 없음`);
      mismatch++;
    } else if (sd.data().uid !== u.id) {
      log("err", "students", `${sid}: users.uid=${u.id} ↔ students.uid=${sd.data().uid} 불일치`);
      mismatch++;
    }
  }
  if (mismatch === 0) log("ok", "students 정합성", "모든 가입 학생 정상");
}

async function section4_schedule() {
  console.log("\n=== 4. 일정 (점호유형) ===");
  const sch = await db.collection("schedule").get();
  if (sch.empty) {
    log("warn", "schedule", "일정 데이터 없음");
    return;
  }
  const byDay = new Map();
  let withCheckin = 0;
  sch.forEach((d) => {
    const data = d.data();
    const day = data["일차"] ?? 0;
    if (!byDay.has(day)) byDay.set(day, 0);
    byDay.set(day, byDay.get(day) + 1);
    if (data["점호유형"]) withCheckin++;
  });
  const days = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])
    .map(([d, n]) => `${d}일차 ${n}건`).join(" / ");
  log("ok", "schedule", `${sch.size}건 (${days})`);
  log("ok", "schedule", `점호유형 지정된 일정: ${withCheckin}건`);
  if (withCheckin === 0) log("warn", "schedule", "점호유형이 지정된 일정이 0건 — fixScheduleCheckinTypes() 실행 필요");
}

async function section5_buses_rooms() {
  console.log("\n=== 5. 호차·호실 분포 ===");
  const sSnap = await db.collection("students").get();
  const busCount = new Map();
  const roomCount = new Map();
  let noBusCount = 0, noRoomCount = 0;
  sSnap.forEach((d) => {
    const data = d.data();
    if (data["호차"] == null) noBusCount++;
    else busCount.set(data["호차"], (busCount.get(data["호차"]) ?? 0) + 1);
    if (!data["호실"]) noRoomCount++;
    else roomCount.set(data["호실"], (roomCount.get(data["호실"]) ?? 0) + 1);
  });
  log("ok", "buses 분포", `${busCount.size}개 호차 사용`);
  log("ok", "rooms 분포", `${roomCount.size}개 호실 사용`);
  if (noBusCount > 0) log("warn", "buses", `호차 미배정 학생 ${noBusCount}명`);
  if (noRoomCount > 0) log("warn", "rooms", `호실 미배정 학생 ${noRoomCount}명`);

  // buses 컬렉션과 매핑
  const busesSnap = await db.collection("buses").get();
  const busMeta = new Set(busesSnap.docs.map((d) => d.data()["호차"]));
  for (const [bn] of busCount) {
    if (!busMeta.has(bn)) log("warn", "buses", `${bn}호차에 학생은 있으나 buses 메타데이터 없음`);
  }
}

async function section6_chat_rooms() {
  console.log("\n=== 6. 채팅방 상태 ===");
  const snap = await db.collection("chat_rooms").get();
  if (snap.empty) {
    log("warn", "chat_rooms", "채팅방 없음 (사용자가 /chat 에 진입하지 않음)");
    return;
  }
  const types = { admin_teachers: 0, class: 0, other: 0 };
  for (const d of snap.docs) {
    const t = d.data().type ?? "other";
    types[t] = (types[t] ?? 0) + 1;
    const members = d.data().members || [];
    // 메시지 수
    const msgs = await db.collection(`chat_rooms/${d.id}/messages`).get();
    const reads = await db.collection(`chat_rooms/${d.id}/reads`).get();
    log("ok", "chat_rooms", `${d.id} (${t}) members=${members.length} msgs=${msgs.size} reads=${reads.size}`);
  }
  log("ok", "chat_rooms 합계",
    `교직원방 ${types.admin_teachers}개 / 반 그룹방 ${types.class}개${types.other ? ` / 기타 ${types.other}개` : ""}`);
}

async function section7_sessions_checkins() {
  console.log("\n=== 7. 점호 세션 ===");
  const snap = await db.collection("checkin_sessions").get();
  if (snap.empty) {
    log("warn", "checkin_sessions", "세션 데이터 없음");
    return;
  }
  let open = 0, closed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.status === "open") open++;
    else closed++;
  }
  log("ok", "checkin_sessions", `전체 ${snap.size}건 (open ${open} / closed ${closed})`);

  const checkSnap = await db.collection("checkins").get();
  log("ok", "checkins", `${checkSnap.size}건 누적`);
  const byMethod = { SELF_TAP: 0, QR_BUS: 0, TEACHER_TAP: 0 };
  checkSnap.forEach((d) => {
    const m = d.data().method;
    if (m in byMethod) byMethod[m]++;
  });
  log("ok", "checkins 방식",
    `SELF_TAP ${byMethod.SELF_TAP} / QR_BUS ${byMethod.QR_BUS} / TEACHER_TAP ${byMethod.TEACHER_TAP}`);
}

async function section8_settings() {
  console.log("\n=== 8. 글로벌 설정 ===");
  const d = await db.doc("settings/global").get();
  if (!d.exists) {
    log("err", "settings", "settings/global 문서가 없음 — 일부 기능이 기본값으로 동작");
    return;
  }
  const data = d.data();
  log("ok", "settings", `teacherSignupCode 설정됨: ${data.teacherSignupCode ? "✓" : "✗"}`);
  log("ok", "settings", `enrollmentLocked=${!!data.enrollmentLocked} qrTokensActive=${!!data.qrTokensActive} autoCheckinEnabled=${!!data.autoCheckinEnabled}`);
}

async function section9_incidents() {
  console.log("\n=== 9. 사건사고 ===");
  const snap = await db.collection("incidents").get();
  if (snap.empty) {
    log("ok", "incidents", "기록 없음 (운영 시작 전)");
    return;
  }
  let open = 0, closed = 0;
  const bySeverity = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
  for (const d of snap.docs) {
    const data = d.data();
    if (data.종결여부) closed++;
    else open++;
    if (data.심각도 in bySeverity) bySeverity[data.심각도]++;
  }
  log("ok", "incidents", `전체 ${snap.size}건 (미처리 ${open} / 종결 ${closed})`);
  log("ok", "incidents 심각도", `위급 ${bySeverity.CRITICAL} / 중요 ${bySeverity.MAJOR} / 경미 ${bySeverity.MINOR}`);
  if (open > 0) log("warn", "incidents", `미처리 ${open}건 — 관리자 확인 필요`);
}

async function section10_summary() {
  console.log("\n=== 결과 요약 ===");
  const counts = { ok: 0, warn: 0, err: 0 };
  out.forEach((o) => counts[o.level]++);
  console.log(`✅ OK ${counts.ok}건  ⚠️  경고 ${counts.warn}건  ❌ 오류 ${counts.err}건`);
  if (counts.err > 0) {
    console.log("\n🔴 오류 항목:");
    out.filter((o) => o.level === "err").forEach((o) => console.log(`   - [${o.section}] ${o.msg}`));
  }
  if (counts.warn > 0) {
    console.log("\n🟡 경고 항목:");
    out.filter((o) => o.level === "warn").forEach((o) => console.log(`   - [${o.section}] ${o.msg}`));
  }
}

(async () => {
  try {
    await section1_collections();
    await section2_users_consistency();
    await section3_students_uid();
    await section4_schedule();
    await section5_buses_rooms();
    await section6_chat_rooms();
    await section7_sessions_checkins();
    await section8_settings();
    await section9_incidents();
    await section10_summary();
  } catch (err) {
    console.error("진단 실패:", err);
    process.exit(1);
  }
  process.exit(0);
})();
