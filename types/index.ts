import { DocumentReference, Timestamp } from "firebase/firestore";

// ── Student ────────────────────────────────────────────────────
export interface Student {
  id: string; // G{학년}-C{반}-N{번호}
  학년: number;
  반: number;
  번호: number;
  이름: string;
  호차: number;
  호실: string;
  층: number;
  학생연락처: string;
  보호자연락처: string;
  건강요주의사항: string;
  특이사항: string;
  잔류여부: boolean;
  요양호여부: boolean;
  비행편: string;
  uid?: string;
  createdAt?: Timestamp;
}

// ── Room ──────────────────────────────────────────────────────
export interface Room {
  id: string; // 호실번호
  호실: string;
  층: number;
  담당교사: string;
  정원: number;
  특이사항: string;
}

// ── Schedule ──────────────────────────────────────────────────
export type CheckinType = "정시점호" | "승차점호" | null;

export interface Schedule {
  id: string;
  일차: number;
  시작시각: string; // "HH:MM"
  종료시각: string;
  일정명: string;
  장소: string;
  점호유형: CheckinType;
  비고: string;
}

// ── Bus ───────────────────────────────────────────────────────
export interface Bus {
  id: string; // B{호차}
  호차: number;
  탑승반: string;
  인솔교사1: string;
  인솔교사2: string;
  기사명: string;
  기사연락처: string;
}

// ── Contact ───────────────────────────────────────────────────
export interface Contact {
  id: string;
  구분: string;
  이름: string;
  연락처: string;
  공개여부: "Y" | "N";
}

// ── User ──────────────────────────────────────────────────────
export type UserRole = "student" | "teacher" | "admin";

export interface AppUser {
  uid: string;
  role: UserRole;
  studentRef?: string; // /students/G2-C3-N12
  이름?: string;
  담임학년?: number;
  담임반?: number;
  fcmTokens?: string[]; // 푸시 알림용 (디바이스별 토큰 누적)
}

// ── CheckinSession ────────────────────────────────────────────
export type SessionScope =
  | "전체"
  | `학급:${number}`
  | `호실:${string}`
  | `호차:${number}`;

export type SessionStatus = "open" | "closed";
export type SessionTrigger = "auto" | "manual";

export interface CheckinSession {
  id: string;
  eventRef?: string; // /schedule/{eventId}
  type: "정시점호" | "승차점호";
  scope: SessionScope;
  trigger: SessionTrigger;
  name: string;
  startAt: Timestamp;
  endAt: Timestamp;
  status: SessionStatus;
  openedBy?: string;
  openedAt?: Timestamp;
  closedBy?: string;
  closedAt?: Timestamp;
}

// ── Checkin ───────────────────────────────────────────────────
export type CheckinMethod = "SELF_TAP" | "QR_BUS" | "TEACHER_TAP";

export interface Checkin {
  id: string;
  sessionRef: string;
  studentRef: string;
  method: CheckinMethod;
  busScanned?: number;
  timestamp: Timestamp;
  byUid: string;
}

// ── Incident ──────────────────────────────────────────────────
export type IncidentSeverity = "CRITICAL" | "MAJOR" | "MINOR";

export interface Incident {
  id: string;
  유형: string;
  심각도: IncidentSeverity;
  관련학생: string[]; // studentRef paths
  내용: string;
  조치: string;
  종결여부: boolean;
  timestamp: Timestamp;
  byUid: string;
}

// ── Settings ──────────────────────────────────────────────────
export interface GlobalSettings {
  teacherSignupCode: string;
  enrollmentLocked: boolean;
  qrTokensActive: boolean;
  graceMinutes: number;
}

// ── UI helpers ────────────────────────────────────────────────
export type CheckinStatus =
  | "PENDING"
  | "SELF"
  | "TEACHER"
  | "BOTH"
  | "MISSING"
  | "LOCKED";

// ── Chat ──────────────────────────────────────────────────────
// admin_teachers: 관리자·교사 양방향
// class:          담임·관리자 → 반 학생들 일방향(공지)  — 학생은 읽기 전용
export type ChatRoomType = "admin_teachers" | "class";

export interface ChatRoom {
  id: string;
  type: ChatRoomType;
  name: string;
  members: string[];           // uid 배열 (읽기 권한)
  학년?: number;               // class
  반?: number;                 // class
  lastMessage?: string;        // 최근 메시지 미리보기
  lastMessageAt?: Timestamp;
  lastSenderName?: string;
  createdAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  senderRole: UserRole;
  timestamp: Timestamp;
}

// 채팅방별 사용자의 마지막 읽음 시각 (chat_rooms/{roomId}/reads/{uid})
export interface ChatRoomRead {
  id: string;            // = uid
  uid: string;
  lastReadAt: Timestamp;
  name?: string;         // 표시용
  role?: UserRole;
  학년?: number;
  반?: number;
  번호?: number;
}
