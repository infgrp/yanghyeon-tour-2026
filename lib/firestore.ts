import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Student,
  Room,
  Schedule,
  Bus,
  Contact,
  CheckinSession,
  Checkin,
  Incident,
  GlobalSettings,
  SessionScope,
  AppUser,
  ChatRoom,
  ChatMessage,
  ChatRoomRead,
  UserRole,
} from "@/types";

// ── Students ──────────────────────────────────────────────────
export async function getStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

export async function getStudent(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, "students", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Student) : null;
}

export function subscribeStudents(cb: (s: Student[]) => void) {
  return onSnapshot(collection(db, "students"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)))
  );
}

// ── Schedule ──────────────────────────────────────────────────
export async function getSchedule(): Promise<Schedule[]> {
  const snap = await getDocs(collection(db, "schedule"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Schedule))
    .sort((a, b) => {
      const dayDiff = a.일차 - b.일차;
      if (dayDiff !== 0) return dayDiff;
      const tA = a.시작시각 || a.종료시각 || "99:99";
      const tB = b.시작시각 || b.종료시각 || "99:99";
      return tA.localeCompare(tB);
    });
}

// ── Contacts (public) ─────────────────────────────────────────
export async function getPublicContacts(): Promise<Contact[]> {
  const snap = await getDocs(
    query(collection(db, "contacts"), where("공개여부", "==", "Y"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact));
}

export async function getAllContacts(): Promise<Contact[]> {
  const snap = await getDocs(collection(db, "contacts"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact));
}

// ── Buses ─────────────────────────────────────────────────────
export async function getBuses(): Promise<Bus[]> {
  const snap = await getDocs(collection(db, "buses"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bus));
}

// ── Rooms ─────────────────────────────────────────────────────
export async function getRooms(): Promise<Room[]> {
  const snap = await getDocs(collection(db, "rooms"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Room));
}

// ── Settings ──────────────────────────────────────────────────
export async function getSettings(): Promise<GlobalSettings | null> {
  const snap = await getDoc(doc(db, "settings", "global"));
  return snap.exists() ? (snap.data() as GlobalSettings) : null;
}

export async function updateSettings(data: Partial<GlobalSettings>) {
  await setDoc(doc(db, "settings", "global"), data, { merge: true });
}

// ── CheckinSessions ───────────────────────────────────────────
export function subscribeOpenSessions(cb: (sessions: CheckinSession[]) => void) {
  const q = query(
    collection(db, "checkin_sessions"),
    where("status", "==", "open"),
    orderBy("startAt", "desc")
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckinSession)))
  );
}

export async function getOpenSessions(): Promise<CheckinSession[]> {
  const snap = await getDocs(
    query(
      collection(db, "checkin_sessions"),
      where("status", "==", "open"),
      orderBy("startAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckinSession));
}

export async function createManualSession(params: {
  type: "정시점호" | "승차점호";
  scope: SessionScope;
  name: string;
  durationMinutes: number;
  openedBy: string;
}): Promise<string> {
  const now = Timestamp.now();
  const endAt = Timestamp.fromDate(
    new Date(Date.now() + params.durationMinutes * 60_000)
  );
  const ref = await addDoc(collection(db, "checkin_sessions"), {
    type: params.type,
    scope: params.scope,
    name: params.name,
    trigger: "manual",
    startAt: now,
    endAt,
    status: "open",
    openedBy: params.openedBy,
    openedAt: now,
    eventRef: null,
  });
  return ref.id;
}

export async function extendSession(sessionId: string, extraMinutes: number) {
  const ref = doc(db, "checkin_sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as CheckinSession;
  const currentEnd = data.endAt.toDate();
  const newEnd = new Date(currentEnd.getTime() + extraMinutes * 60_000);
  await updateDoc(ref, { endAt: Timestamp.fromDate(newEnd) });
}

export async function closeSession(sessionId: string, closedBy: string) {
  await updateDoc(doc(db, "checkin_sessions", sessionId), {
    status: "closed",
    closedBy,
    closedAt: Timestamp.now(),
    endAt: Timestamp.now(),
  });
}

// ── Checkins ──────────────────────────────────────────────────
export async function createCheckin(params: {
  sessionId: string;
  studentId: string;
  method: Checkin["method"];
  byUid: string;
  busScanned?: number;
}) {
  await addDoc(collection(db, "checkins"), {
    sessionRef: `/checkin_sessions/${params.sessionId}`,
    studentRef: `/students/${params.studentId}`,
    method: params.method,
    busScanned: params.busScanned || null,
    timestamp: Timestamp.now(),
    byUid: params.byUid,
  });
}

/**
 * 교사가 수동으로 학생을 탑승 처리한다. 이미 체크인이 있으면 skip.
 * 동일 세션에 같은 학생의 checkin doc 이 여러 개 생기지 않도록
 * 사전 조회로 dedupe.
 */
export async function manualCheckin(params: {
  sessionId: string;
  studentId: string;
  byUid: string;
  busScanned?: number;
}): Promise<{ created: boolean }> {
  const sessionRef = `/checkin_sessions/${params.sessionId}`;
  const studentRef = `/students/${params.studentId}`;

  // 중복 확인
  const existing = await getDocs(query(
    collection(db, "checkins"),
    where("sessionRef", "==", sessionRef),
    where("studentRef", "==", studentRef),
  ));
  if (!existing.empty) return { created: false };

  await addDoc(collection(db, "checkins"), {
    sessionRef,
    studentRef,
    method: "TEACHER_TAP",
    busScanned: params.busScanned ?? null,
    timestamp: Timestamp.now(),
    byUid: params.byUid,
  });
  return { created: true };
}

/**
 * 수동 체크인을 취소한다 (교사가 잘못 눌렀을 때).
 * 해당 세션·학생의 모든 체크인 doc 을 삭제.
 */
export async function undoManualCheckin(params: {
  sessionId: string;
  studentId: string;
}): Promise<{ removed: number }> {
  const snap = await getDocs(query(
    collection(db, "checkins"),
    where("sessionRef", "==", `/checkin_sessions/${params.sessionId}`),
    where("studentRef", "==", `/students/${params.studentId}`),
  ));
  if (snap.empty) return { removed: 0 };
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return { removed: snap.size };
}

export function subscribeSessionCheckins(
  sessionId: string,
  cb: (checkins: Checkin[]) => void
) {
  const q = query(
    collection(db, "checkins"),
    where("sessionRef", "==", `/checkin_sessions/${sessionId}`)
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkin)))
  );
}

export async function getStudentTodayCheckins(studentRef: string): Promise<Checkin[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const q = query(
    collection(db, "checkins"),
    where("studentRef", "==", studentRef),
    where("timestamp", ">=", Timestamp.fromDate(todayStart)),
    orderBy("timestamp", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkin));
}

// ── Incidents ─────────────────────────────────────────────────
export async function createIncident(data: Omit<Incident, "id" | "timestamp">) {
  await addDoc(collection(db, "incidents"), {
    ...data,
    timestamp: serverTimestamp(),
  });
}

export async function getIncidents(): Promise<Incident[]> {
  const snap = await getDocs(
    query(collection(db, "incidents"), orderBy("timestamp", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Incident));
}

export async function updateIncident(id: string, data: Partial<Incident>) {
  await updateDoc(doc(db, "incidents", id), data);
}

// ── Batch upload (admin) ─────────────────────────────────────
export async function batchUpsertStudents(students: Omit<Student, "id" | "uid" | "createdAt">[]) {
  const batch = writeBatch(db);
  for (const s of students) {
    const id = `G${s.학년}-C${s.반}-N${s.번호}`;
    batch.set(doc(db, "students", id), { ...s, createdAt: serverTimestamp() }, { merge: true });
  }
  await batch.commit();
}

export async function batchUpsertRooms(rooms: Omit<Room, "id">[]) {
  const batch = writeBatch(db);
  for (const r of rooms) {
    batch.set(doc(db, "rooms", r.호실), r, { merge: true });
  }
  await batch.commit();
}

// 일정 점호유형 일괄 설정:
//   "학교 집결" 포함 또는 "숙소" + ("도착"|"휴식") → 정시점호
//   나머지 전체 → 승차점호
export async function fixScheduleCheckinTypes() {
  const snap = await getDocs(collection(db, "schedule"));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const name: string = d.data().일정명 ?? "";
    const isJeongsi =
      name.includes("학교 집결") ||
      (name.includes("숙소") && (name.includes("도착") || name.includes("휴식")));
    const noCheckin = name.includes("아침조식");
    const type = noCheckin ? null : isJeongsi ? "정시점호" : "승차점호";
    batch.update(d.ref, { 점호유형: type });
  });
  await batch.commit();
}

export async function batchUpsertSchedule(schedules: Omit<Schedule, "id">[]) {
  // 기존 전체 삭제 후 재삽입
  const existing = await getDocs(collection(db, "schedule"));
  const batch = writeBatch(db);
  existing.docs.forEach((d) => batch.delete(d.ref));
  for (const s of schedules) {
    batch.set(doc(collection(db, "schedule")), s);
  }
  await batch.commit();
}

export async function batchUpsertBuses(buses: Omit<Bus, "id">[]) {
  const batch = writeBatch(db);
  for (const b of buses) {
    batch.set(doc(db, "buses", `B${b.호차}`), b, { merge: true });
  }
  await batch.commit();
}

export async function batchUpsertContacts(contacts: Omit<Contact, "id">[]) {
  const existing = await getDocs(collection(db, "contacts"));
  const batch = writeBatch(db);
  existing.docs.forEach((d) => batch.delete(d.ref));
  for (const c of contacts) {
    batch.set(doc(collection(db, "contacts")), c);
  }
  await batch.commit();
}

// ── Admin: reset student uid ──────────────────────────────────
export async function resetStudentUid(studentId: string) {
  await updateDoc(doc(db, "students", studentId), { uid: null });
}

// ── Admin: teacher accounts ───────────────────────────────────
export async function getTeachers(): Promise<AppUser[]> {
  const snap = await getDocs(
    query(collection(db, "users"), where("role", "==", "teacher"))
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
}

// ── Chat ──────────────────────────────────────────────────────
const CHAT_PREVIEW_LIMIT = 60;

function classRoomId(학년: number, 반: number) {
  return `class_G${학년}_C${반}`;
}

export function subscribeMyChatRooms(
  uid: string,
  cb: (rooms: ChatRoom[]) => void
) {
  const q = query(
    collection(db, "chat_rooms"),
    where("members", "array-contains", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatRoom));
      rooms.sort((a, b) => {
        const tA = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const tB = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return tB - tA;
      });
      cb(rooms);
    },
    () => { /* 로그아웃 등으로 권한 만료 시 조용히 무시 */ }
  );
}

export async function getChatRoom(roomId: string): Promise<ChatRoom | null> {
  const snap = await getDoc(doc(db, "chat_rooms", roomId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ChatRoom) : null;
}

export function subscribeRoomMessages(
  roomId: string,
  cb: (msgs: ChatMessage[]) => void,
  max = 200
) {
  const q = query(
    collection(db, "chat_rooms", roomId, "messages"),
    orderBy("timestamp", "desc"),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
      msgs.reverse(); // 화면 표시는 오래된 → 최신
      cb(msgs);
    },
    () => { /* 로그아웃 등으로 권한 만료 시 조용히 무시 */ }
  );
}

export async function sendChatMessage(params: {
  roomId: string;
  text: string;
  sender: { uid: string; name: string; role: UserRole };
}) {
  if (params.sender.role === "student") {
    throw new Error("학생은 메시지를 보낼 수 없습니다.");
  }
  const text = params.text.trim();
  if (!text) return;
  const now = Timestamp.now();
  const msgRef = collection(db, "chat_rooms", params.roomId, "messages");
  await addDoc(msgRef, {
    text,
    senderUid: params.sender.uid,
    senderName: params.sender.name,
    senderRole: params.sender.role,
    timestamp: now,
  });
  const preview = text.length > CHAT_PREVIEW_LIMIT
    ? text.slice(0, CHAT_PREVIEW_LIMIT) + "…"
    : text;
  await updateDoc(doc(db, "chat_rooms", params.roomId), {
    lastMessage: preview,
    lastMessageAt: now,
    lastSenderName: params.sender.name,
  });
}

// 관리자·교사 전체방 보장 (고정 ID)
export async function ensureAdminTeacherRoom(myUid: string): Promise<string> {
  const roomId = "admin_teachers";
  const ref = doc(db, "chat_rooms", roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const teachersSnap = await getDocs(
      query(collection(db, "users"), where("role", "in", ["teacher", "admin"]))
    );
    const members = teachersSnap.docs.map((d) => d.id);
    if (!members.includes(myUid)) members.push(myUid);
    await setDoc(ref, {
      type: "admin_teachers",
      name: "관리자·교사 전체방",
      members,
      createdAt: Timestamp.now(),
    });
  } else {
    const data = snap.data() as ChatRoom;
    if (!data.members.includes(myUid)) {
      await updateDoc(ref, { members: arrayUnion(myUid) });
    }
  }
  return roomId;
}

// 반 그룹방 보장 (담임 + 반 학생들 + 관리자들)
export async function ensureClassRoom(params: {
  학년: number;
  반: number;
  myUid: string;
}): Promise<string> {
  const roomId = classRoomId(params.학년, params.반);
  const ref = doc(db, "chat_rooms", roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const [studentsSnap, teachersSnap] = await Promise.all([
      getDocs(query(
        collection(db, "students"),
        where("학년", "==", params.학년),
        where("반", "==", params.반)
      )),
      getDocs(query(collection(db, "users"), where("role", "in", ["teacher", "admin"]))),
    ]);
    const members = new Set<string>();
    members.add(params.myUid);
    studentsSnap.docs.forEach((d) => {
      const uid = d.data().uid as string | undefined;
      if (uid) members.add(uid);
    });
    // 담임 + 관리자
    teachersSnap.docs.forEach((d) => {
      const data = d.data() as AppUser;
      if (data.role === "admin") members.add(d.id);
      if (data.role === "teacher" && data.담임학년 === params.학년 && data.담임반 === params.반) {
        members.add(d.id);
      }
    });
    await setDoc(ref, {
      type: "class",
      name: `${params.학년}학년 ${params.반}반`,
      members: Array.from(members),
      학년: params.학년,
      반: params.반,
      createdAt: Timestamp.now(),
    });
  } else {
    const data = snap.data() as ChatRoom;
    if (!data.members.includes(params.myUid)) {
      await updateDoc(ref, { members: arrayUnion(params.myUid) });
    }
  }
  return roomId;
}

// ── Chat: 읽음 추적 ──────────────────────────────────────────
// 사용자가 채팅방을 열거나 새 메시지를 본 시점에 호출 — lastReadAt 갱신
export async function markRoomAsRead(params: {
  roomId: string;
  reader: {
    uid: string;
    name?: string;
    role?: UserRole;
    학년?: number;
    반?: number;
    번호?: number;
  };
}) {
  const { roomId, reader } = params;
  const ref = doc(db, "chat_rooms", roomId, "reads", reader.uid);
  // undefined 필드 제거 (Firestore에서 undefined는 거부)
  const data: Record<string, unknown> = {
    uid: reader.uid,
    lastReadAt: Timestamp.now(),
  };
  if (reader.name !== undefined) data.name = reader.name;
  if (reader.role !== undefined) data.role = reader.role;
  if (reader.학년 !== undefined) data.학년 = reader.학년;
  if (reader.반 !== undefined) data.반 = reader.반;
  if (reader.번호 !== undefined) data.번호 = reader.번호;
  await setDoc(ref, data, { merge: true });
}

// 특정 방의 모든 사용자 lastReadAt 구독 (교사·관리자용 — 누가 읽었나 확인)
export function subscribeRoomReads(
  roomId: string,
  cb: (reads: ChatRoomRead[]) => void
) {
  const ref = collection(db, "chat_rooms", roomId, "reads");
  return onSnapshot(
    ref,
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatRoomRead))),
    () => { /* 로그아웃 등 무시 */ }
  );
}

// 내 모든 방의 lastReadAt 구독 (목록 페이지 안 읽음 배지용)
//   collectionGroup("reads") 중 documentId == myUid 인 것만 가져옴.
export function subscribeMyReads(
  myUid: string,
  cb: (readsByRoomId: Record<string, ChatRoomRead>) => void
) {
  const q = query(collectionGroup(db, "reads"), where("uid", "==", myUid));
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, ChatRoomRead> = {};
      snap.docs.forEach((d) => {
        // 경로: chat_rooms/{roomId}/reads/{uid}
        const segs = d.ref.path.split("/");
        const roomId = segs[1];
        map[roomId] = { id: d.id, ...d.data() } as ChatRoomRead;
      });
      cb(map);
    },
    () => { /* 로그아웃 등 무시 */ }
  );
}

// 사용자 진입 시 자동으로 본인이 속해야 할 방을 모두 ensure
// 학생은 1:1 DM 없음 — 반별 공지방(읽기 전용)만 보장
export async function autoEnsureRoomsForUser(appUser: AppUser): Promise<void> {
  const uid = appUser.uid;

  // 1) 교직원 전체방 (admin/teacher)
  if (appUser.role === "admin" || appUser.role === "teacher") {
    await ensureAdminTeacherRoom(uid).catch(() => {});
  }

  // 2) 담임이면 본인 반 그룹방
  if (appUser.role === "teacher" && appUser.담임학년 && appUser.담임반) {
    await ensureClassRoom({
      학년: appUser.담임학년,
      반: appUser.담임반,
      myUid: uid,
    }).catch(() => {});
  }

  // 3) 학생이면 본인 반 그룹방 (읽기 전용)
  if (appUser.role === "student" && appUser.studentRef) {
    const studentId = appUser.studentRef.split("/").pop()!;
    const studentSnap = await getDoc(doc(db, "students", studentId)).catch(() => null);
    if (!studentSnap || !studentSnap.exists()) return;
    const student = { id: studentSnap.id, ...studentSnap.data() } as Student;

    await ensureClassRoom({
      학년: student.학년,
      반: student.반,
      myUid: uid,
    }).catch(() => {});
  }
}

// ── 관리자 일괄 공지 발송 ─────────────────────────────────────
// 지정된 학년·반들의 그룹방에 동일한 메시지를 동시 발송.
// 방이 없으면 ensureClassRoom으로 자동 생성한다.
export async function broadcastAnnouncement(params: {
  targets: { 학년: number; 반: number }[];        // 발송 대상 반 목록
  text: string;
  sender: { uid: string; name: string; role: UserRole };
  alsoSendToAdminTeachers?: boolean;               // 교직원 방에도 사본 발송
}): Promise<{ ok: number; failed: { 학년: number; 반: number }[] }> {
  const text = params.text.trim();
  if (!text) return { ok: 0, failed: [] };

  let ok = 0;
  const failed: { 학년: number; 반: number }[] = [];

  for (const t of params.targets) {
    try {
      const roomId = await ensureClassRoom({
        학년: t.학년,
        반: t.반,
        myUid: params.sender.uid,
      });
      await sendChatMessage({
        roomId,
        text,
        sender: params.sender,
      });
      ok++;
    } catch {
      failed.push(t);
    }
  }

  if (params.alsoSendToAdminTeachers) {
    try {
      const adminRoomId = await ensureAdminTeacherRoom(params.sender.uid);
      await sendChatMessage({
        roomId: adminRoomId,
        text: `[전체 공지 발송됨]\n${text}`,
        sender: params.sender,
      });
    } catch { /* 부수 알림은 실패해도 무시 */ }
  }

  return { ok, failed };
}

// ── FCM 토큰 ──────────────────────────────────────────────────
export async function setUserFcmToken(uid: string, token: string) {
  if (!token) return;
  await updateDoc(doc(db, "users", uid), {
    fcmTokens: arrayUnion(token),
  }).catch(async () => {
    // 문서가 일부 필드만 있는 경우 fallback (merge)
    await setDoc(doc(db, "users", uid), { fcmTokens: [token] }, { merge: true });
  });
}

export async function removeUserFcmToken(uid: string, token: string) {
  if (!token) return;
  await updateDoc(doc(db, "users", uid), {
    fcmTokens: arrayRemove(token),
  }).catch(() => { /* 문서 없거나 권한 없으면 무시 */ });
}

// ── Admin: 버스 인솔교사1 → 담임반 동기화 ─────────────────────
export async function syncTeacherHomerooms(): Promise<number> {
  const [buses, teachers] = await Promise.all([getBuses(), getTeachers()]);
  const batch = writeBatch(db);
  let count = 0;
  for (const bus of buses) {
    const 반 = parseInt(String(bus.탑승반));
    if (isNaN(반)) continue;
    const teacher = teachers.find((t) => t.이름 === bus.인솔교사1);
    if (!teacher) continue;
    batch.update(doc(db, "users", teacher.uid), { 담임반: 반 });
    count++;
  }
  await batch.commit();
  return count;
}
