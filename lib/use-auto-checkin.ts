"use client";

/**
 * 클라이언트 폴링 기반 자동 점호 hook.
 * Cloud Function (Blaze 요금제) 없이 동작하기 위한 fallback.
 *
 * 동작:
 *   1) 매 1분마다 schedule 컬렉션에서 (현재 일차, 현재 HH:MM) 매칭되는
 *      점호 이벤트가 있는지 확인 → 있으면 자동으로 checkin_session 생성.
 *   2) 매 1분마다 만료된 (endAt 지난) open 세션을 자동으로 status=closed.
 *
 * 한계:
 *   - admin 등 hook 호출 페이지가 열려있어야만 동작.
 *   - 같은 시각에 여러 admin 페이지가 열려있으면 race condition 발생 가능
 *     (이미 존재하는 eventRef 세션은 skip 하므로 중복 생성은 거의 없음).
 */

import { useEffect, useRef } from "react";
import {
  collection, getDocs, addDoc, doc,
  query, where, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { notifyCheckinSession } from "./notify";

interface AutoCheckinOptions {
  uid: string | undefined;
  enabled: boolean;
  tripStart: Date;            // 수학여행 시작 시각 (KST 기준)
  tripEnd: Date;              // 수학여행 종료 시각
  graceMinutes?: number;      // 세션 유지 시간 (기본 30분)
  intervalMs?: number;        // 폴링 간격 (기본 60초)
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toKst(d: Date): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

export function useAutoCheckin(opts: AutoCheckinOptions) {
  const { uid, enabled, tripStart, tripEnd } = opts;
  const grace = opts.graceMinutes ?? 30;
  const interval = opts.intervalMs ?? 60_000;
  const lastMinuteKey = useRef("");
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled || !uid) return;

    async function tick() {
      if (busy.current) return;
      busy.current = true;
      try {
        const nowKst = toKst(new Date());

        // 1) 만료된 open 세션 정리 — 수학여행 기간과 무관하게 항상 실행
        await closeExpiredOpenSessions(uid!);

        // 2) 자동 점호 세션 생성 — 수학여행 기간 안에서만
        if (nowKst >= tripStart && nowKst <= tripEnd) {
          const dayIdx = Math.floor((nowKst.getTime() - tripStart.getTime()) / DAY_MS) + 1;
          const hh = String(nowKst.getHours()).padStart(2, "0");
          const mm = String(nowKst.getMinutes()).padStart(2, "0");
          const hhmm = `${hh}:${mm}`;
          const minuteKey = `${dayIdx}-${hhmm}`;

          if (lastMinuteKey.current !== minuteKey) {
            lastMinuteKey.current = minuteKey;
            await maybeCreateAutoSessions({
              dayIdx, hhmm, nowKst, uid: uid!, graceMinutes: grace,
            });
          }
        }
      } catch (err) {
        // 권한·네트워크 에러 등 — 조용히 다음 tick 으로
        console.warn("[auto-checkin] tick error:", err);
      } finally {
        busy.current = false;
      }
    }

    tick();
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [uid, enabled, tripStart, tripEnd, grace, interval]);
}

async function closeExpiredOpenSessions(closedBy: string) {
  const now = Timestamp.now();
  const snap = await getDocs(query(
    collection(db, "checkin_sessions"),
    where("status", "==", "open"),
  )).catch(() => null);
  if (!snap || snap.empty) return;

  const expired = snap.docs.filter((d) => {
    const end = d.data().endAt;
    return end && end.toMillis && end.toMillis() <= now.toMillis();
  });
  if (expired.length === 0) return;

  const batch = writeBatch(db);
  for (const d of expired) {
    batch.update(doc(db, "checkin_sessions", d.id), {
      status: "closed",
      closedBy,
      closedAt: now,
    });
  }
  await batch.commit().catch((e) => console.warn("[auto-checkin] close batch failed:", e));
}

async function maybeCreateAutoSessions(params: {
  dayIdx: number;
  hhmm: string;
  nowKst: Date;
  uid: string;
  graceMinutes: number;
}) {
  const { dayIdx, hhmm, nowKst, uid, graceMinutes } = params;

  // 매칭되는 schedule 이벤트 조회
  const sSnap = await getDocs(query(
    collection(db, "schedule"),
    where("일차", "==", dayIdx),
    where("시작시각", "==", hhmm),
  )).catch(() => null);
  if (!sSnap || sSnap.empty) return;

  for (const sDoc of sSnap.docs) {
    const data = sDoc.data();
    if (!data.점호유형) continue;

    // 이미 같은 schedule 이벤트로 open 세션이 있는지 확인
    const existSnap = await getDocs(query(
      collection(db, "checkin_sessions"),
      where("eventRef", "==", `/schedule/${sDoc.id}`),
      where("status", "==", "open"),
    )).catch(() => null);
    if (existSnap && !existSnap.empty) continue;

    const endAt = new Date(nowKst.getTime() + graceMinutes * 60_000);
    const sessionName = `${data.일정명 ?? "자동점호"} (${dayIdx}일차)`;
    const docRef = await addDoc(collection(db, "checkin_sessions"), {
      eventRef: `/schedule/${sDoc.id}`,
      type: data.점호유형,
      scope: "전체",
      trigger: "auto",
      name: sessionName,
      startAt: Timestamp.fromDate(nowKst),
      endAt: Timestamp.fromDate(endAt),
      status: "open",
      openedBy: uid,
      openedAt: Timestamp.fromDate(nowKst),
    }).catch((e) => { console.warn("[auto-checkin] addDoc failed:", e); return null; });

    if (docRef) {
      notifyCheckinSession({ sessionId: docRef.id, type: String(data.점호유형), name: sessionName, scope: "전체" });
    }
    console.log(`[auto-checkin] created: ${data.일정명} day=${dayIdx} ${hhmm}`);
  }
}
