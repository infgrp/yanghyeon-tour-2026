import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  limit,
  DocumentReference,
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
