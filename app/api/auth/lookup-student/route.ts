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

// 가입 전 학번 조회 — 이름과 가입 여부만 반환 (전화번호 등 민감 정보 제외)
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

    const studentId = `G${학년}-C${반}-N${번호}`;
    const snap = await admin.firestore().doc(`students/${studentId}`).get();

    if (!snap.exists) {
      return NextResponse.json({ found: false });
    }

    const data = snap.data()!;
    return NextResponse.json({
      found: true,
      id: studentId,
      이름: (data.이름 as string) ?? "",
      가입됨: !!data.uid,
    });
  } catch (err) {
    console.error("[lookup-student]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
