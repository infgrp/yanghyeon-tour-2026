"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import { AppUser, UserRole } from "@/types";

// ── 역할 확인 (Custom Claims) ──────────────────────────────────
export async function getUserRole(user: User): Promise<UserRole | null> {
  const idTokenResult = await user.getIdTokenResult(true);
  return (idTokenResult.claims.role as UserRole) || null;
}

// ── 학생 학번 조회 (가입 전, Cloud Function callable 호출) ───
export async function lookupStudent(학년: number, 반: number, 번호: number) {
  const callable = httpsCallable<
    { 학년: number; 반: number; 번호: number },
    { found: boolean; id?: string; 이름?: string; 가입됨?: boolean }
  >(functions, "lookupStudent");
  const res = await callable({ 학년, 반, 번호 });
  if (!res.data.found) return null;
  return {
    id: res.data.id!,
    이름: res.data.이름 ?? "",
    가입됨: !!res.data.가입됨,
  };
}

// ── 학생 가입 ─────────────────────────────────────────────────
//   1) Firebase Auth 가입
//   2) Callable function 으로 users + students.uid 업데이트
//      (students.uid 쓰기는 admin 권한 필요하므로 server-side 처리)
export async function registerStudent(params: {
  학년: number;
  반: number;
  번호: number;
  email: string;
  password: string;
  privacyConsent: boolean;
}): Promise<{ success: boolean; error?: string; studentName?: string }> {
  const { 학년, 반, 번호, email, password, privacyConsent } = params;

  // 1) 사전 학번 확인 (callable lookup)
  const found = await lookupStudent(학년, 반, 번호);
  if (!found) {
    return { success: false, error: "해당 학번의 학생을 찾을 수 없습니다." };
  }
  if (found.가입됨) {
    return {
      success: false,
      error: "이미 가입된 학번입니다. 도용 의심 시 관리자에게 문의하세요.",
    };
  }

  // 2) Firebase Auth 가입 — 본인 인증 확보
  await createUserWithEmailAndPassword(auth, email, password);

  // 3) Callable로 users 문서 생성 + students.uid 업데이트 (admin 권한)
  const completeRegistration = httpsCallable<
    { 학년: number; 반: number; 번호: number; privacyConsent: boolean },
    { success: boolean; studentName: string }
  >(functions, "completeStudentRegistration");

  try {
    const res = await completeRegistration({ 학년, 반, 번호, privacyConsent });
    return { success: true, studentName: res.data.studentName };
  } catch (err: unknown) {
    // 가입 함수 실패 시 — 이미 만들어진 Auth 계정은 남지만
    // 같은 이메일로 다시 시도 가능 (lookup 단계에서 가입됨 체크)
    const msg = err instanceof Error ? err.message : "가입 완료 처리 실패";
    return { success: false, error: msg };
  }
}

// ── 교사 가입 ─────────────────────────────────────────────────
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

  // 1) 교사 코드 확인
  const validCode = process.env.NEXT_PUBLIC_TEACHER_CODE;
  if (!validCode || code !== validCode) {
    return { success: false, error: "교사 가입 코드가 올바르지 않습니다." };
  }

  // 2) Firebase Auth 가입
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // 3) /users/{uid} 문서 생성
  await setDoc(doc(db, "users", uid), {
    role: "teacher",
    이름,
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
