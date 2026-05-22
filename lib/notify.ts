"use client";

import { getAuth } from "firebase/auth";

/**
 * 점호 세션 시작 알림을 Vercel API Route를 통해 FCM으로 발송한다.
 * fire-and-forget — await 없이 호출해도 세션 생성 흐름을 막지 않는다.
 */
export function notifyCheckinSession(params: {
  sessionId: string;
  type: string;
  name: string;
  scope: string;
}): void {
  const user = getAuth().currentUser;
  if (!user) return;

  user.getIdToken()
    .then((token) =>
      fetch("/api/notify/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      }),
    )
    .catch((err) => console.warn("[notify] session push failed:", err));
}

/**
 * 미응답 학생에게 점호 마감 전 리마인더 Push를 발송한다.
 * fire-and-forget. 교사/관리자 토큰으로 호출해야 한다.
 */
export function notifyCheckinReminder(sessionId: string): void {
  const user = getAuth().currentUser;
  if (!user) return;

  user.getIdToken()
    .then((token) =>
      fetch("/api/notify/reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      }),
    )
    .catch((err) => console.warn("[notify] reminder push failed:", err));
}
