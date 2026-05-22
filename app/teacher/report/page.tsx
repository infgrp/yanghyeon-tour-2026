"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle, XCircle, ChevronLeft, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CheckinSession, Student } from "@/types";

interface SessionReport {
  session: CheckinSession;
  checkedInRefs: Set<string>;
  total: number;
  checked: number;
}

function formatDateTime(ts: Timestamp | undefined) {
  if (!ts) return "–";
  return ts.toDate().toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function pct(checked: number, total: number) {
  if (!total) return 0;
  return Math.round((checked / total) * 100);
}

export default function ReportPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionReport[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Date filter (KST date string "YYYY-MM-DD")
  const todayKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const todayStr = todayKst.toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(todayStr);

  useEffect(() => {
    if (!appUser) return;
    if (!["teacher", "admin"].includes(appUser.role)) {
      router.replace("/");
    }
  }, [appUser, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setSelectedSession(null);
    try {
      // Build date range
      const [year, month, day] = dateFilter.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59);

      const [sessSnap, stuSnap] = await Promise.all([
        getDocs(query(
          collection(db, "checkin_sessions"),
          where("startAt", ">=", Timestamp.fromDate(start)),
          where("startAt", "<=", Timestamp.fromDate(end)),
          orderBy("startAt", "desc"),
        )),
        getDocs(collection(db, "students")),
      ]);

      const allStudents = stuSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
      setStudents(allStudents);

      const reports: SessionReport[] = [];
      for (const sDoc of sessSnap.docs) {
        const session = { id: sDoc.id, ...sDoc.data() } as CheckinSession;

        // Scope filter for teacher (non-admin sees only own class)
        if (appUser?.role === "teacher") {
          const scope = session.scope;
          if (scope !== "전체") {
            if (scope.startsWith("학급:")) {
              const 반 = Number(scope.split(":")[1]);
              if (반 !== appUser.담임반) continue;
            }
          }
        }

        const checkinsSnap = await getDocs(query(
          collection(db, "checkins"),
          where("sessionRef", "==", `/checkin_sessions/${sDoc.id}`),
        ));
        const checkedInRefs = new Set(
          checkinsSnap.docs.map((d) => d.data().studentRef as string),
        );

        // Determine scope student count
        let scopeStudents = allStudents;
        if (session.scope.startsWith("학급:")) {
          const 반 = Number(session.scope.split(":")[1]);
          scopeStudents = allStudents.filter((s) => s.반 === 반);
        } else if (session.scope.startsWith("호실:")) {
          const 호실 = session.scope.split(":")[1];
          scopeStudents = allStudents.filter((s) => s.호실 === 호실);
        } else if (session.scope.startsWith("호차:")) {
          const 호차 = Number(session.scope.split(":")[1]);
          scopeStudents = allStudents.filter((s) => s.호차 === 호차);
        }

        reports.push({
          session,
          checkedInRefs,
          total: scopeStudents.length,
          checked: checkedInRefs.size,
        });
      }
      setSessions(reports);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, appUser]);

  useEffect(() => { load(); }, [load]);

  // Students for selected session detail
  const sessionStudents = selectedSession
    ? (() => {
        const scope = selectedSession.session.scope;
        let list = students;
        if (scope.startsWith("학급:")) {
          const 반 = Number(scope.split(":")[1]);
          list = students.filter((s) => s.반 === 반);
        } else if (scope.startsWith("호실:")) {
          list = students.filter((s) => s.호실 === scope.split(":")[1]);
        } else if (scope.startsWith("호차:")) {
          list = students.filter((s) => s.호차 === Number(scope.split(":")[1]));
        }
        return list.sort((a, b) => a.반 - b.반 || a.번호 - b.번호);
      })()
    : [];

  // CSV export
  function exportCsv() {
    if (!selectedSession) return;
    const rows = [["학년", "반", "번호", "이름", "점호여부"]];
    for (const s of sessionStudents) {
      const ref = `/students/${s.id}`;
      rows.push([
        String(s.학년), String(s.반), String(s.번호), s.이름,
        selectedSession.checkedInRefs.has(ref) ? "O" : "X",
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedSession.session.name}_점호결과.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!appUser) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">점호 이력 리포트</h1>
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Date filter */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600 shrink-0">날짜 선택</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Session list or detail */}
        {selectedSession ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Detail header */}
            <div className="p-4 border-b flex items-start justify-between gap-2">
              <div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-sm text-blue-600 hover:underline mb-1 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />목록으로
                </button>
                <h2 className="font-bold text-gray-900">{selectedSession.session.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDateTime(selectedSession.session.startAt)} –{" "}
                  {formatDateTime(selectedSession.session.endAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-bold text-blue-600">
                  {pct(selectedSession.checked, selectedSession.total)}%
                </span>
                <p className="text-xs text-gray-400">
                  {selectedSession.checked}/{selectedSession.total}명
                </p>
              </div>
            </div>

            {/* Export */}
            <div className="px-4 py-2 border-b bg-gray-50 flex justify-end">
              <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />CSV 다운로드
              </Button>
            </div>

            {/* Student list */}
            <div className="divide-y">
              {sessionStudents.map((s) => {
                const checked = selectedSession.checkedInRefs.has(`/students/${s.id}`);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      checked ? "" : "bg-red-50"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-sm text-gray-900">{s.이름}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {s.학년}학년 {s.반}반 {s.번호}번
                      </span>
                    </div>
                    {checked ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                  </div>
                );
              })}
              {sessionStudents.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">학생 데이터가 없습니다.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">
                해당 날짜의 점호 이력이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((r) => {
                  const rate = pct(r.checked, r.total);
                  const open = r.session.status === "open";
                  return (
                    <button
                      key={r.session.id}
                      onClick={() => setSelectedSession(r)}
                      className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">
                              {r.session.name}
                            </span>
                            <Badge variant={open ? "default" : "secondary"} className="text-xs">
                              {open ? "진행중" : "종료"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {r.session.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDateTime(r.session.startAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-xl font-bold ${
                              rate >= 90
                                ? "text-green-600"
                                : rate >= 70
                                  ? "text-yellow-500"
                                  : "text-red-500"
                            }`}
                          >
                            {rate}%
                          </span>
                          <p className="text-xs text-gray-400">
                            {r.checked}/{r.total}
                          </p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rate >= 90
                              ? "bg-green-500"
                              : rate >= 70
                                ? "bg-yellow-400"
                                : "bg-red-400"
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
