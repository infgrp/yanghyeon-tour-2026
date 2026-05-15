"use client";

import { getToken, onMessage } from "firebase/messaging";
import { getMessagingInstance } from "./firebase";
import { setUserFcmToken, removeUserFcmToken } from "./firestore";
import { toast } from "sonner";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const SW_PATH = "/firebase-messaging-sw.js";

// 브라우저가 알림을 지원하고 활성화 가능한 환경인지
export function notificationsSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  return true;
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * 알림 권한을 요청하고 FCM 토큰을 발급받아 Firestore에 저장한다.
 * 이미 권한이 부여된 상태라면 토큰만 갱신.
 * 거부 / 미지원 환경에서는 false 반환.
 */
export async function requestAndRegisterFcmToken(uid: string): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (!VAPID_KEY) {
    console.warn("FCM: NEXT_PUBLIC_FIREBASE_VAPID_KEY 가 설정되지 않았습니다.");
    return false;
  }

  // 권한 요청 (이미 granted면 즉시 통과)
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return false;
    }
  }
  if (permission !== "granted") return false;

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return false;

    // FCM 전용 service worker 등록 — PWA 의 sw.js 와 별도로 동작
    const swReg = await navigator.serviceWorker
      .register(SW_PATH, { scope: "/firebase-cloud-messaging-push-scope" })
      .catch(() => null);
    if (!swReg) return false;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return false;

    await setUserFcmToken(uid, token);
    return true;
  } catch (err) {
    console.warn("FCM 토큰 발급 실패:", err);
    return false;
  }
}

/**
 * 로그아웃 시 호출 — 현재 디바이스 토큰을 사용자 문서에서 제거.
 * 토큰을 못 가져와도 silent fail.
 */
export async function unregisterFcmToken(uid: string): Promise<void> {
  if (!notificationsSupported() || !VAPID_KEY) return;
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    const swReg = await navigator.serviceWorker
      .getRegistration("/firebase-cloud-messaging-push-scope")
      .catch(() => null);
    if (!swReg) return;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    }).catch(() => null);
    if (token) await removeUserFcmToken(uid, token);
  } catch {
    /* noop */
  }
}

/**
 * Foreground 알림 리스너. 페이지가 활성화된 상태에서 도착한 메시지는
 * 브라우저가 자동 표시하지 않으므로 toast 로 노출한다.
 */
export async function listenForegroundMessages(): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "새 알림";
    const body = payload.notification?.body ?? payload.data?.body ?? "";
    toast(title, { description: body });
  });
}
