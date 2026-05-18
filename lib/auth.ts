"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { AppUser, UserRole } from "@/types";

// ── 역할 확인 (Custom Claims) ──────────────────────────────────
export async function getUserRole(user: User): Promise<UserRole | null> {
  const idTokenResult = await user.getIdTokenResult(true);
  return (idTokenResult.claims.role as UserRole) || null;
}

// ── 학생 학번 조회 (가입 전 이름 확인용) ──────────────────────
// firestore.rules에서 students read는 누구나 허용됨
export async function lookupStudent(학년: number, 반: number, 번호: number) {
  const studentId = `G${학년}-C${반}-N${번호}`;
  const snap = await getDoc(doc(db, "students", studentId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: studentId, 이름: data.이름 as string, 가입됨: !!data.uid };
}

// ── 학생 가입 ─────────────────────────────────────────────────
//   1) 학번 doc 존재 + 미가입 확인
//   2) Firebase Auth 가입
//   3) /users/{uid} 문서 생성 (본인 권한)
//   4) /students/{id}.uid 본인 uid로 업데이트
//      (firestore.rules에서 본인이 자기 학번 doc의 uid 필드만 쓸 수 있게 허용됨)
export async function registerStudent(params: {
  학년: number;
  반: number;
  번호: number;
  email: string;
  password: string;
  privacyConsent: boolean;
}): Promise<{ success: boolean; error?: string; studentName?: string }> {
  const { 학년, 반, 번호, email, password } = params;
  const studentId = `G${학년}-C${반}-N${번호}`;

  // 1) 학생 존재 + 미가입 확인
  const studentRef = doc(db, "students", studentId);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) {
    return { success: false, error: "해당 학번의 학생을 찾을 수 없습니다." };
  }
  const studentData = studentSnap.data();
  if (studentData.uid) {
    return {
      success: false,
      error: "이미 가입된 학번입니다. 도용 의심 시 관리자에게 문의하세요.",
    };
  }

  // 2) Firebase Auth 가입
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // 3) /users/{uid} 문서 생성 (담임이 학번으로 이메일 조회·비번 재설정할 수 있도록 email 저장)
  await setDoc(doc(db, "users", uid), {
    role: "student",
    studentRef: `/students/${studentId}`,
    email,
    createdAt: serverTimestamp(),
  });

  // 4) /students/{id}.uid 업데이트 — rules에서 본인 가입에만 허용됨
  await updateDoc(studentRef, { uid });

  return { success: true, studentName: studentData.이름 as string };
}

// ── 교사 가입 ─────────────────────────────────────────────────
//   교사 코드는 settings/global.teacherSignupCode 와 비교한다.
//   (이전엔 NEXT_PUBLIC_TEACHER_CODE 환경변수도 fallback 했지만 클라이언트
//    번들 노출 우려로 제거. 관리자가 admin 페이지에서 언제든 코드 변경 가능.)
export async function registerTeacher(params: {
  code: string;
  이름: string;
  담임학년?: number;
  담임반?: number;
  email: string;
  password: string;
  privacyConsent: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { code, 이름, 담임학년, 담임반, email, password } = params;

  // 1) 교사 코드 확인 — settings/global 의 teacherSignupCode 와 비교
  const settingsSnap = await getDoc(doc(db, "settings", "global"));
  const validCode = settingsSnap.exists()
    ? (settingsSnap.data() as { teacherSignupCode?: string }).teacherSignupCode
    : undefined;
  if (!validCode) {
    return { success: false, error: "교사 가입 코드가 설정되어 있지 않습니다. 관리자에게 문의하세요." };
  }
  if (code.trim() !== validCode) {
    return { success: false, error: "교사 가입 코드가 올바르지 않습니다." };
  }

  // 2) Firebase Auth 가입
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // 3) /users/{uid} 문서 생성
  await setDoc(doc(db, "users", uid), {
    role: "teacher",
    이름,
    email,
    담임학년: 담임학년 || null,
    담임반: 담임반 || null,
    createdAt: serverTimestamp(),
  });

  return { success: true };
}

// ── 로그인 ────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// ── 로그아웃 ──────────────────────────────────────────────────
export async function signOut() {
  return firebaseSignOut(auth);
}

// ── 현재 유저 정보 조회 ───────────────────────────────────────
export async function fetchAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<AppUser, "uid">) };
}

// ── 학번으로 학생 가입 정보 조회 (담임용) ────────────────────
//   학번(G{학년}-C{반}-N{번호}) 으로 students.uid → users 문서 조회.
//   가입된 이메일을 반환. 미가입이면 null.
export async function lookupStudentAccount(학년: number, 반: number, 번호: number): Promise<{
  email: string | null;
  uid: string | null;
  studentName: string;
} | null> {
  const studentId = `G${학년}-C${반}-N${번호}`;
  const sSnap = await getDoc(doc(db, "students", studentId));
  if (!sSnap.exists()) return null;
  const sData = sSnap.data() as { 이름?: string; uid?: string };
  if (!sData.uid) {
    return { email: null, uid: null, studentName: sData.이름 ?? "" };
  }

  // users 문서에서 email 조회
  const uSnap = await getDoc(doc(db, "users", sData.uid));
  let email: string | null = null;
  if (uSnap.exists()) {
    const u = uSnap.data() as { email?: string };
    email = u.email ?? null;
  }
  return { email, uid: sData.uid, studentName: sData.이름 ?? "" };
}

// ── 학생 비밀번호 재설정 이메일 발송 (담임용) ──────────────
//   Firebase Auth 의 sendPasswordResetEmail 호출.
//   학생이 본인 이메일을 확인할 수 있어야 동작.
//   본인 이메일 접근 불가 케이스는 관리자가
//   scripts/set-student-password.js 로 직접 임시 비번 설정.
export async function sendStudentPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

