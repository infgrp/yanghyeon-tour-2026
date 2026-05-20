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

async function collectTokens(db: admin.firestore.Firestore, uids: string[]) {
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
  params: {
    tokens: string[];
    uidByToken: Map<string, string>;
    notification: { title: string; body: string };
    data: Record<string, string>;
  },
) {
  if (!params.tokens.length) return { sent: 0, failed: 0 };

  const resp = await admin.messaging().sendEachForMulticast({
    tokens: params.tokens,
    notification: params.notification,
    data: params.data,
    webpush: { fcmOptions: { link: params.data.url ?? "/" } },
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
        const uid = params.uidByToken.get(params.tokens[i]);
        if (uid) {
          if (!removeByUid.has(uid)) removeByUid.set(uid, []);
          removeByUid.get(uid)!.push(params.tokens[i]);
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

export async function POST(req: NextRequest) {
  try {
    getAdminApp();

    // Verify Firebase ID token and require admin role
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.replace(/^Bearer\s+/, "");
    if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { sessionId, type, name, scope } = (await req.json()) as {
      sessionId: string; type: string; name: string; scope: string;
    };
    if (!sessionId || !scope) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const db = admin.firestore();

    // Collect target student UIDs based on scope
    let targetUids: string[] = [];
    const stuRef = db.collection("students");
    let stuSnap: admin.firestore.QuerySnapshot | null = null;

    if (scope === "전체") {
      stuSnap = await stuRef.get();
    } else if (scope.startsWith("학급:")) {
      stuSnap = await stuRef.where("반", "==", Number(scope.split(":")[1])).get();
    } else if (scope.startsWith("호실:")) {
      stuSnap = await stuRef.where("호실", "==", scope.split(":")[1]).get();
    } else if (scope.startsWith("호차:")) {
      stuSnap = await stuRef.where("호차", "==", Number(scope.split(":")[1])).get();
    }

    stuSnap?.forEach((d) => {
      const uid = d.data().uid as string | undefined;
      if (uid) targetUids.push(uid);
    });

    // Also notify all teachers and admins
    const staffSnap = await db.collection("users")
      .where("role", "in", ["teacher", "admin"]).get();
    staffSnap.forEach((d) => targetUids.push(d.id));
    targetUids = Array.from(new Set(targetUids));

    const { uidByToken, tokens } = await collectTokens(db, targetUids);
    const result = await sendAndCleanup(db, {
      tokens,
      uidByToken,
      notification: {
        title: `${type ?? "점호"} 시작`,
        body: `${name ?? "점호"} (${scope})`,
      },
      data: {
        url: type === "승차점호" ? "/student" : "/student",
        tag: `session-${sessionId}`,
        type: "session",
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[notify/session]", err);
    const msg = err instanceof Error ? err.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
