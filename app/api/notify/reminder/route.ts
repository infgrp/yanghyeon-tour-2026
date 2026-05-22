import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin";

function getAdminApp() {
  if (admin.apps.length > 0) return admin.app();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(json) as ServiceAccount),
  });
}

async function collectTokensForUids(db: admin.firestore.Firestore, uids: string[]) {
  const uidByToken = new Map<string, string>();
  if (!uids.length) return { uidByToken, tokens: [] as string[] };
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  for (const chunk of chunks) {
    const snap = await db.collection("users")
      .where(admin.firestore.FieldPath.documentId(), "in", chunk).get();
    snap.forEach((d) => {
      ((d.data().fcmTokens ?? []) as string[]).forEach((t) => uidByToken.set(t, d.id));
    });
  }
  return { uidByToken, tokens: Array.from(uidByToken.keys()) };
}

async function sendAndCleanup(
  db: admin.firestore.Firestore,
  tokens: string[],
  uidByToken: Map<string, string>,
  notification: { title: string; body: string },
  data: Record<string, string>,
) {
  if (!tokens.length) return { sent: 0, failed: 0 };
  const resp = await admin.messaging().sendEachForMulticast({
    tokens,
    notification,
    data,
    webpush: { fcmOptions: { link: data.url ?? "/" } },
  });
  const removeByUid = new Map<string, string[]>();
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
      ) {
        const uid = uidByToken.get(tokens[i]);
        if (uid) {
          if (!removeByUid.has(uid)) removeByUid.set(uid, []);
          removeByUid.get(uid)!.push(tokens[i]);
        }
      }
    }
  });
  await Promise.all(
    Array.from(removeByUid.entries()).map(([uid, bad]) =>
      db.doc(`users/${uid}`).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...bad),
      }).catch(() => {}),
    ),
  );
  return { sent: resp.successCount, failed: resp.failureCount };
}

// POST /api/notify/reminder
// Sends reminder push to students who have NOT checked in yet for a session.
// Called by client-side polling (teacher/admin or auto-checkin hook) ~5 min before endAt.
// Auth: Firebase ID token (teacher or admin).
export async function POST(req: NextRequest) {
  try {
    getAdminApp();

    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.replace(/^Bearer\s+/, "");
    if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!["admin", "teacher"].includes(decoded.role as string)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { sessionId } = (await req.json()) as { sessionId: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const db = admin.firestore();

    // Load session
    const sessionDoc = await db.doc(`checkin_sessions/${sessionId}`).get();
    if (!sessionDoc.exists) return NextResponse.json({ error: "session not found" }, { status: 404 });
    const session = sessionDoc.data()!;
    if (session.status !== "open") return NextResponse.json({ ok: true, sent: 0, reason: "session closed" });

    const sessionRef = `/checkin_sessions/${sessionId}`;

    // Find all students who should check in (based on scope)
    const scope: string = session.scope ?? "전체";
    let stuQuery = db.collection("students") as admin.firestore.Query;
    if (scope.startsWith("학급:")) {
      stuQuery = stuQuery.where("반", "==", Number(scope.split(":")[1]));
    } else if (scope.startsWith("호실:")) {
      stuQuery = stuQuery.where("호실", "==", scope.split(":")[1]);
    } else if (scope.startsWith("호차:")) {
      stuQuery = stuQuery.where("호차", "==", Number(scope.split(":")[1]));
    }

    const stuSnap = await stuQuery.get();
    const allStudentUidToRef = new Map<string, string>();
    stuSnap.forEach((d) => {
      const uid = d.data().uid as string | undefined;
      if (uid) allStudentUidToRef.set(uid, `/students/${d.id}`);
    });

    // Find students who already checked in
    const checkinsSnap = await db.collection("checkins")
      .where("sessionRef", "==", sessionRef).get();
    const checkedInRefs = new Set<string>();
    checkinsSnap.forEach((d) => checkedInRefs.add(d.data().studentRef as string));

    // Missing = students who have not checked in
    const missingUids: string[] = [];
    allStudentUidToRef.forEach((studentRef, uid) => {
      if (!checkedInRefs.has(studentRef)) missingUids.push(uid);
    });

    if (!missingUids.length) return NextResponse.json({ ok: true, sent: 0, reason: "all checked in" });

    const { uidByToken, tokens } = await collectTokensForUids(db, missingUids);
    const sessionName: string = session.name ?? "점호";
    const endAt = session.endAt?.toDate?.() as Date | undefined;
    const minutesLeft = endAt
      ? Math.max(0, Math.round((endAt.getTime() - Date.now()) / 60_000))
      : 5;

    const result = await sendAndCleanup(
      db,
      tokens,
      uidByToken,
      {
        title: `[리마인더] ${sessionName}`,
        body: `마감 ${minutesLeft}분 전입니다. 아직 점호에 참여하지 않았습니다!`,
      },
      {
        url: "/student",
        tag: `reminder-${sessionId}`,
        type: "reminder",
        sessionId,
      },
    );

    return NextResponse.json({ ok: true, ...result, missing: missingUids.length });
  } catch (err) {
    console.error("[notify/reminder]", err);
    const msg = err instanceof Error ? err.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
