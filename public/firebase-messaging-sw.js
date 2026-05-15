// Firebase Cloud Messaging service worker
// PWA 의 sw.js (workbox) 와 별도 scope 로 동작.
// 백그라운드 알림 표시를 담당한다.

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// 환경변수는 service worker 에 inject 할 수 없으므로 하드코딩.
// .env.local 의 NEXT_PUBLIC_FIREBASE_* 값과 동일해야 함.
firebase.initializeApp({
  apiKey: "AIzaSyCSfZCjNaxXVQFH2vc1lVc4rAyt5C-G1d4",
  authDomain: "yanghyeon-tour-2026.firebaseapp.com",
  projectId: "yanghyeon-tour-2026",
  storageBucket: "yanghyeon-tour-2026.firebasestorage.app",
  messagingSenderId: "427366403799",
  appId: "1:427366403799:web:a49c090163a309ef726a92",
});

const messaging = firebase.messaging();

// 백그라운드 알림 — 일반적으로 FCM 이 자동 표시하지만,
// data-only 메시지의 경우 직접 표시한다.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title)
    || (payload.data && payload.data.title)
    || "새 알림";
  const body = (payload.notification && payload.notification.body)
    || (payload.data && payload.data.body)
    || "";
  const url = (payload.data && payload.data.url) || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.data?.tag,
    data: { url },
  });
});

// 알림 클릭 시 해당 URL 로 포커스/오픈
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
