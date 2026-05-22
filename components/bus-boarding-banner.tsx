"use client";

import { useEffect, useState, useMemo } from "react";
import { Bus } from "lucide-react";
import {
  collection, query, where, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CheckinSession, Checkin, Student } from "@/types";

interface BusBoardingBannerProps {
  /** All students — caller passes this to avoid duplicate fetches */
  students: Student[];
  /** Open sessions — caller passes this to avoid duplicate subscriptions */
  sessions: CheckinSession[];
}

interface BusRow {
  호차: number;
  total: number;
  checked: number;
}

/**
 * 승차점호 세션이 열려있을 때만 렌더링되는 호차별 실시간 탑승률 배너.
 * students와 sessions는 부모에서 주입받는다.
 */
export function BusBoardingBanner({ students, sessions }: BusBoardingBannerProps) {
  const boardingSession = useMemo(
    () => sessions.find((s) => s.type === "승차점호" && s.status === "open") ?? null,
    [sessions],
  );

  const [checkins, setCheckins] = useState<Checkin[]>([]);

  useEffect(() => {
    if (!boardingSession) { setCheckins([]); return; }
    const q = query(
      collection(db, "checkins"),
      where("sessionRef", "==", `/checkin_sessions/${boardingSession.id}`),
    );
    const unsub = onSnapshot(q, (snap) =>
      setCheckins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Checkin))),
    );
    return unsub;
  }, [boardingSession?.id]);

  const busRows = useMemo<BusRow[]>(() => {
    if (!boardingSession) return [];

    const checkedRefs = new Set(checkins.map((c) => c.studentRef));

    // Group students by 호차
    const byBus = new Map<number, { total: number; checked: number }>();
    for (const s of students) {
      if (!s.호차) continue;
      if (!byBus.has(s.호차)) byBus.set(s.호차, { total: 0, checked: 0 });
      const row = byBus.get(s.호차)!;
      row.total++;
      if (checkedRefs.has(`/students/${s.id}`)) row.checked++;
    }

    return Array.from(byBus.entries())
      .map(([호차, v]) => ({ 호차, ...v }))
      .sort((a, b) => a.호차 - b.호차);
  }, [boardingSession, students, checkins]);

  if (!boardingSession || busRows.length === 0) return null;

  const totalAll = busRows.reduce((s, r) => s + r.total, 0);
  const checkedAll = busRows.reduce((s, r) => s + r.checked, 0);
  const overallPct = totalAll ? Math.round((checkedAll / totalAll) * 100) : 0;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-4 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4" />
          <span className="font-semibold text-sm">{boardingSession.name}</span>
        </div>
        <span className="text-sm font-bold">
          {checkedAll}/{totalAll}명 ({overallPct}%)
        </span>
      </div>

      {/* Per-bus rows */}
      <div className="space-y-2">
        {busRows.map((row) => {
          const pct = row.total ? Math.round((row.checked / row.total) * 100) : 0;
          const full = pct === 100;
          return (
            <div key={row.호차}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{row.호차}호차</span>
                <span className={full ? "text-green-300 font-semibold" : "text-blue-100"}>
                  {row.checked}/{row.total} ({pct}%)
                </span>
              </div>
              <div className="h-2 bg-blue-800/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    full ? "bg-green-400" : pct >= 80 ? "bg-yellow-300" : "bg-white/70"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
