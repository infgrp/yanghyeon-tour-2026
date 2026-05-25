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

function classRoomId(학년: number, 반: number) {
  return `class_G${학년}_C${반}`;
}

const ADMIN_TEACHER_ROOM_ID = "admin_teachers";

// POST /api/chat/ensure-membership
//
// 호출자(인증된 사용자)를 본인이 속해야 할 채팅방의 members 에 추가한다.
//   - 학생: 본인 반(학년/반) 그룹방
//   - 교사(담임): 담임 반 그룹방 + 관리자·교사 전체방
//   - 교사(담임 아님)·관리자: 관리자·교사 전체방
//
// 방이 아직 존재하지 않으면 skip — 관리자가 첫 broadcast 시 ensureClassRoom 으로 생성한다.
// 이미 멤버면 noop. 멱등하므로 로그인할 때마다 호출돼도 안전.
//
// 서버에서 Admin SDK 로 실행해 firestore.rules 의 update 제약(비-멤버는 거부)을 우회한다.
// 클라이언트의 lib/firestore.ts `ensureClassRoom` 은 비-멤버 학생이 호출하면 권한 오류로
// 실패하기 때문에 이 라우트가 필요하다.
export async function POST(req: NextRequest) {
  try {
    getAdminApp();

    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.replace(/^Bearer\s+/, "");
    if (!idToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();

    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const userData = userSnap.data()!;
    const role = userData.role as string | undefined;

    const roomsToJoin: string[] = [];

    if (role === "student") {
      const studentRef = userData.studentRef as string | undefined;
      if (studentRef) {
        const sid = studentRef.replace(/^\/students\//, "");
        const sSnap = await db.doc(`students/${sid}`).get();
        if (sSnap.exists) {
          const sData = sSnap.data()!;
          const 학년 = sData.학년 as number | undefined;
          const 반 = sData.반 as number | undefined;
          if (학년 && 반) roomsToJoin.push(classRoomId(학년, 반));
        }
      }
    } else if (role === "teacher") {
      roomsToJoin.push(ADMIN_TEACHER_ROOM_ID);
      const 담임학년 = userData.담임학년 as number | undefined;
      const 담임반 = userData.담임반 as number | undefined;
      if (담임학년 && 담임반) roomsToJoin.push(classRoomId(담임학년, 담임반));
    } else if (role === "admin") {
      roomsToJoin.push(ADMIN_TEACHER_ROOM_ID);
    }

    const joined: string[] = [];
    const skipped: string[] = [];

    for (const roomId of roomsToJoin) {
      const ref = db.doc(`chat_rooms/${roomId}`);
      const snap = await ref.get();
      if (!snap.exists) {
        skipped.push(roomId);
        continue;
      }
      const data = snap.data()!;
      const members = (data.members as string[]) ?? [];
      if (members.includes(uid)) {
        skipped.push(roomId);
        continue;
      }
      await ref.update({
        members: admin.firestore.FieldValue.arrayUnion(uid),
      });
      joined.push(roomId);
    }

    return NextResponse.json({ ok: true, joined, skipped });
  } catch (err) {
    console.error("[chat/ensure-membership]", err);
    const msg = err instanceof Error ? err.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
