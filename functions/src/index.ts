import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

admin.initializeApp();
const db = admin.firestore();

// ── Custom Claims 자동 부여 ───────────────────────────────────────
// 신규 사용자 문서 생성 시 Custom Claims 설정
export const onUserCreated = onDocumentCreated(
  { document: "users/{uid}", region: "asia-northeast3" },
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data) return;

    const role = data.role as string | undefined;
    if (!role) return;

    try {
      await admin.auth().setCustomUserClaims(uid, { role });
      console.log(`Custom claim set: uid=${uid}, role=${role}`);
    } catch (err) {
      console.error("setCustomUserClaims error:", err);
    }
  }
);

// ── 자동 점호 세션 생성 ──────────────────────────────────────────
// 매 1분마다 schedule 컬렉션에서 현재 시각과 매칭되는 점호 이벤트 확인
export const autoCreateCheckinSession = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    const now = new Date();
    const todayKST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

    // 오늘이 수학여행 기간인지 확인 (2026-05-26 ~ 2026-05-29)
    const tripStart = new Date("2026-05-26T00:00:00+09:00");
    const tripEnd = new Date("2026-05-29T23:59:59+09:00");
    if (todayKST < tripStart || todayKST > tripEnd) return;

    // 현재 일차 계산
    const dayMs = 24 * 60 * 60 * 1000;
    const dayIdx = Math.floor((todayKST.getTime() - tripStart.getTime()) / dayMs) + 1;

    // 현재 시각 HH:MM
    const hhmm = `${todayKST.getHours().toString().padStart(2, "0")}:${todayKST.getMinutes().toString().padStart(2, "0")}`;

    // 해당 일차+시각의 점호 이벤트 조회
    const scheduleSnap = await db
      .collection("schedule")
      .where("일차", "==", dayIdx)
      .where("시작시각", "==", hhmm)
      .get();

    for (const doc of scheduleSnap.docs) {
      const ev = doc.data();
      if (!ev.점호유형) continue; // 점호 없는 일정은 무시

      // 이미 이 이벤트에 대한 세션이 있는지 확인
      const existing = await db
        .collection("checkin_sessions")
        .where("eventRef", "==", `/schedule/${doc.id}`)
        .where("status", "==", "open")
        .get();
      if (!existing.empty) continue;

      // 세션 생성
      const settingsSnap = await db.doc("settings/global").get();
      const grace = settingsSnap.exists
        ? (settingsSnap.data()?.graceMinutes ?? 30)
        : 30;

      const endAt = new Date(todayKST.getTime() + grace * 60_000);

      await db.collection("checkin_sessions").add({
        eventRef: `/schedule/${doc.id}`,
        type: ev.점호유형,
        scope: "전체",
        trigger: "auto",
        name: `${ev.일정명} (${dayIdx}일차)`,
        startAt: Timestamp.fromDate(todayKST),
        endAt: Timestamp.fromDate(endAt),
        status: "open",
        openedBy: "system",
        openedAt: Timestamp.fromDate(todayKST),
      });

      console.log(`Auto session created: ${ev.일정명} day=${dayIdx} time=${hhmm}`);
    }
  }
);

// ── 만료 세션 자동 종결 ──────────────────────────────────────────
export const autoCloseExpiredSessions = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
  },
  async () => {
    const now = Timestamp.now();
    const expired = await db
      .collection("checkin_sessions")
      .where("status", "==", "open")
      .where("endAt", "<=", now)
      .get();

    const batch = db.batch();
    for (const doc of expired.docs) {
      batch.update(doc.ref, {
        status: "closed",
        closedBy: "system",
        closedAt: now,
      });
    }
    if (!expired.empty) {
      await batch.commit();
      console.log(`Auto-closed ${expired.size} expired sessions`);
    }
  }
);

// ── Callable: Custom Claims 수동 갱신 (관리자 전용) ───────────────
export const refreshCustomClaims = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

    // 호출자가 admin인지 확인
    const callerToken = await admin.auth().getUser(callerUid);
    const callerClaims = callerToken.customClaims as Record<string, unknown> | undefined;
    if (callerClaims?.role !== "admin") {
      throw new HttpsError("permission-denied", "관리자만 사용 가능합니다.");
    }

    const { targetUid } = request.data as { targetUid: string };
    if (!targetUid) throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");

    const userDoc = await db.doc(`users/${targetUid}`).get();
    if (!userDoc.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");

    const role = userDoc.data()?.role as string;
    await admin.auth().setCustomUserClaims(targetUid, { role });

    return { success: true, role };
  }
);

// ── Callable: 교사 가입 코드 검증 ────────────────────────────────
export const verifyTeacherCode = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { code } = request.data as { code: string };
    const settingsSnap = await db.doc("settings/global").get();
    if (!settingsSnap.exists) throw new HttpsError("not-found", "설정을 찾을 수 없습니다.");

    const storedCode = settingsSnap.data()?.teacherSignupCode;
    return { valid: storedCode === code };
  }
);

// ── FCM 푸시 알림 헬퍼 ────────────────────────────────────────
async function collectFcmTokens(uids: string[]): Promise<{
  uidByToken: Map<string, string>;
  tokens: string[];
}> {
  const uidByToken = new Map<string, string>();
  if (uids.length === 0) return { uidByToken, tokens: [] };

  // Firestore in 쿼리는 30개 제한 → 청크 분할
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));

  for (const chunk of chunks) {
    const snap = await db.collection("users").where("__name__", "in", chunk).get();
    snap.forEach((doc) => {
      const tokens = (doc.data().fcmTokens as string[] | undefined) ?? [];
      tokens.forEach((t) => uidByToken.set(t, doc.id));
    });
  }
  return { uidByToken, tokens: Array.from(uidByToken.keys()) };
}

// 멀티캐스트 후 무효 토큰 정리
async function sendMulticastAndCleanup(params: {
  tokens: string[];
  uidByToken: Map<string, string>;
  notification: { title: string; body: string };
  data?: Record<string, string>;
}) {
  if (params.tokens.length === 0) return;

  const messaging = admin.messaging();
  const resp = await messaging.sendEachForMulticast({
    tokens: params.tokens,
    notification: params.notification,
    data: params.data,
    webpush: {
      fcmOptions: { link: params.data?.url ?? "/" },
    },
  });

  // 무효한 토큰을 사용자 문서에서 제거
  const removeByUid = new Map<string, string[]>();
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered"
        || code === "messaging/invalid-registration-token"
        || code === "messaging/invalid-argument"
      ) {
        const token = params.tokens[i];
        const uid = params.uidByToken.get(token);
        if (uid) {
          if (!removeByUid.has(uid)) removeByUid.set(uid, []);
          removeByUid.get(uid)!.push(token);
        }
      }
    }
  });

  for (const [uid, badTokens] of removeByUid) {
    await db.doc(`users/${uid}`).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...badTokens),
    }).catch(() => {});
  }
}

// ── 트리거 1: 채팅 새 메시지 → 방 멤버에게 푸시 ────────────────
export const onChatMessageCreated = onDocumentCreated(
  { document: "chat_rooms/{roomId}/messages/{messageId}", region: "asia-northeast3" },
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;
    const roomId = event.params.roomId;

    const roomSnap = await db.doc(`chat_rooms/${roomId}`).get();
    if (!roomSnap.exists) return;
    const room = roomSnap.data() as { members?: string[]; name?: string };

    // 발신자 본인 제외
    const targets = (room.members ?? []).filter((uid) => uid !== msg.senderUid);
    if (targets.length === 0) return;

    const { uidByToken, tokens } = await collectFcmTokens(targets);
    if (tokens.length === 0) return;

    const senderName = (msg.senderName as string) ?? "선생님";
    const text = (msg.text as string) ?? "";
    const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;

    await sendMulticastAndCleanup({
      tokens,
      uidByToken,
      notification: {
        title: room.name ?? "새 메시지",
        body: `${senderName}: ${preview}`,
      },
      data: {
        url: `/chat/${roomId}`,
        tag: `chat-${roomId}`,
        type: "chat",
      },
    });
  }
);

// ── 트리거 2: 새 점호 세션 시작 → 대상자에게 푸시 ───────────────
export const onCheckinSessionCreated = onDocumentCreated(
  { document: "checkin_sessions/{sessionId}", region: "asia-northeast3" },
  async (event) => {
    const session = event.data?.data();
    if (!session) return;
    if (session.status !== "open") return;

    const scope: string = session.scope ?? "전체";

    // 대상 학생 결정
    let targetUids: string[] = [];
    const studentsRef = db.collection("students");

    let studentsSnap;
    if (scope === "전체") {
      studentsSnap = await studentsRef.get();
    } else if (scope.startsWith("학급:")) {
      const 반 = Number(scope.split(":")[1]);
      studentsSnap = await studentsRef.where("반", "==", 반).get();
    } else if (scope.startsWith("호실:")) {
      const 호실 = scope.split(":")[1];
      studentsSnap = await studentsRef.where("호실", "==", 호실).get();
    } else if (scope.startsWith("호차:")) {
      const 호차 = Number(scope.split(":")[1]);
      studentsSnap = await studentsRef.where("호차", "==", 호차).get();
    } else {
      return;
    }

    studentsSnap.forEach((d) => {
      const uid = d.data().uid as string | undefined;
      if (uid) targetUids.push(uid);
    });

    // 교사·관리자 전체에도 알림 (운영 인지)
    const teachersSnap = await db.collection("users")
      .where("role", "in", ["teacher", "admin"]).get();
    teachersSnap.forEach((d) => targetUids.push(d.id));

    targetUids = Array.from(new Set(targetUids));
    if (targetUids.length === 0) return;

    const { uidByToken, tokens } = await collectFcmTokens(targetUids);
    if (tokens.length === 0) return;

    await sendMulticastAndCleanup({
      tokens,
      uidByToken,
      notification: {
        title: `${session.type ?? "점호"} 시작`,
        body: `${session.name ?? "점호"} (${scope})`,
      },
      data: {
        url: session.type === "승차점호" ? "/student/qr" : "/student",
        tag: `session-${event.params.sessionId}`,
        type: "session",
      },
    });
  }
);

// ── 트리거 3: 사건사고 등록 → 교사·관리자에게 푸시 ──────────────
export const onIncidentCreated = onDocumentCreated(
  { document: "incidents/{incidentId}", region: "asia-northeast3" },
  async (event) => {
    const incident = event.data?.data();
    if (!incident) return;

    const teachersSnap = await db.collection("users")
      .where("role", "in", ["teacher", "admin"]).get();
    const targetUids = teachersSnap.docs.map((d) => d.id);
    if (targetUids.length === 0) return;

    const { uidByToken, tokens } = await collectFcmTokens(targetUids);
    if (tokens.length === 0) return;

    const severity = (incident.심각도 as string) ?? "MINOR";
    const severityLabel = severity === "CRITICAL" ? "🚨 긴급"
      : severity === "MAJOR" ? "⚠️ 중대" : "ℹ️ 경미";
    const type = (incident.유형 as string) ?? "사건";
    const summary = (incident.내용 as string) ?? "";
    const preview = summary.length > 60 ? summary.slice(0, 60) + "…" : summary;

    await sendMulticastAndCleanup({
      tokens,
      uidByToken,
      notification: {
        title: `${severityLabel} ${type}`,
        body: preview || "사건사고가 등록되었습니다.",
      },
      data: {
        url: "/teacher/incident",
        tag: `incident-${event.params.incidentId}`,
        type: "incident",
      },
    });
  }
);
