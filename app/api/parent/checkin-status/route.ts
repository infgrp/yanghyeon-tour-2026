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

// GET /api/parent/checkin-status?학년=2&반=3&번호=12
// Returns today's check-in status for a student.
// Public endpoint — no auth required. Returns only non-sensitive info.
export async function GET(req: NextRequest) {
  try {
    getAdminApp();
    const { searchParams } = new URL(req.url);
    const 학년 = Number(searchParams.get("학년"));
    const 반 = Number(searchParams.get("반"));
    const 번호 = Number(searchParams.get("번호"));

    if (!학년 || !반 || !번호) {
      return NextResponse.json({ error: "학년, 반, 번호가 필요합니다." }, { status: 400 });
    }

    const db = admin.firestore();
    const studentId = `G${학년}-C${반}-N${번호}`;
    const stuSnap = await db.doc(`students/${studentId}`).get();

    if (!stuSnap.exists) {
      return NextResponse.json({ found: false });
    }

    const stuData = stuSnap.data()!;
    const studentRef = `/students/${studentId}`;

    // Today's range (KST midnight)
    const nowKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const todayStart = new Date(nowKst);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(nowKst);
    todayEnd.setHours(23, 59, 59, 999);

    // Get open sessions today
    const sessionsSnap = await db.collection("checkin_sessions")
      .where("startAt", ">=", admin.firestore.Timestamp.fromDate(todayStart))
      .where("startAt", "<=", admin.firestore.Timestamp.fromDate(todayEnd))
      .orderBy("startAt", "desc")
      .get();

    const sessions: {
      id: string;
      name: string;
      type: string;
      status: string;
      startAt: string;
      endAt: string;
      checkedIn: boolean;
      method?: string;
      checkinAt?: string;
    }[] = [];

    for (const sDoc of sessionsSnap.docs) {
      const s = sDoc.data();

      // Check if student checked in for this session
      const checkinsSnap = await db.collection("checkins")
        .where("sessionRef", "==", `/checkin_sessions/${sDoc.id}`)
        .where("studentRef", "==", studentRef)
        .limit(1)
        .get();

      const checkin = checkinsSnap.docs[0]?.data();
      sessions.push({
        id: sDoc.id,
        name: s.name ?? "",
        type: s.type ?? "",
        status: s.status ?? "closed",
        startAt: s.startAt?.toDate?.()?.toISOString() ?? "",
        endAt: s.endAt?.toDate?.()?.toISOString() ?? "",
        checkedIn: !checkinsSnap.empty,
        method: checkin?.method,
        checkinAt: checkin?.timestamp?.toDate?.()?.toISOString(),
      });
    }

    return NextResponse.json({
      found: true,
      이름: stuData.이름 ?? "",
      학년,
      반,
      번호,
      sessions,
    });
  } catch (err) {
    console.error("[parent/checkin-status]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
