"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Phone, Bus, CheckCircle2, Loader2, LayoutGrid, Armchair,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeStudents, subscribeOpenSessions, subscribeSessionCheckins,
  getBuses, manualCheckin, undoManualCheckin,
} from "@/lib/firestore";
import type { Student, CheckinSession, Checkin, Bus as BusType } from "@/types";
import { BusSeatGrid } from "@/components/bus-seat-grid";
import { MiniDonut } from "@/components/mini-donut";

type ViewMode = "class" | "bus";

function timeLeft(session: CheckinSession): string {
  const diff = session.endAt.toDate().getTime() - Date.now();
  if (diff <= 0) return "마감";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}


export default function BoardingPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<CheckinSession[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [buses, setBuses] = useState<BusType[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [remaining, setRemaining] = useState("");
  const [view, setView] = useState<ViewMode>("class");
  const [working, setWorking] = useState<string | null>(null); // 현재 처리 중인 학생 id

  const boardingSession = useMemo(
    () => sessions.find((s) => s.type === "승차점호") ?? null,
    [sessions]
  );
  const isExpired = boardingSession
    ? boardingSession.endAt.toDate().getTime() <= Date.now()
    : false;

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (appUser?.담임반 && selectedClass === null) {
      setSelectedClass(appUser.담임반);
    }
  }, [appUser, selectedClass]);

  useEffect(() => { return subscribeStudents(setStudents); }, []);
  useEffect(() => { return subscribeOpenSessions(setSessions); }, []);
  useEffect(() => { getBuses().then(setBuses).catch(() => setBuses([])); }, []);

  useEffect(() => {
    if (!boardingSession) { setCheckins([]); return; }
    return subscribeSessionCheckins(boardingSession.id, setCheckins);
  }, [boardingSession]);

  useEffect(() => {
    if (!boardingSession) return;
    setRemaining(timeLeft(boardingSession));
    const id = setInterval(() => setRemaining(timeLeft(boardingSession)), 1000);
    return () => clearInterval(id);
  }, [boardingSession]);

  const checkedIds = useMemo(() => {
    const set = new Set<string>();
    checkins.forEach((c) => set.add(c.studentRef.split("/").pop()!));
    return set;
  }, [checkins]);

  // 반별 그룹
  const classes = useMemo(() => {
    const map = new Map<number, Student[]>();
    students.forEach((s) => {
      if (!map.has(s.반)) map.set(s.반, []);
      map.get(s.반)!.push(s);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([반, list]) => ({
        반,
        total: list.length,
        checked: list.filter((s) => checkedIds.has(s.id)).length,
        students: list.sort((a, b) => a.번호 - b.번호),
      }));
  }, [students, checkedIds]);

  // 호차별 그룹
  const busGroups = useMemo(() => {
    const map = new Map<number, Student[]>();
    students.forEach((s) => {
      if (s.호차 == null) return;
      if (!map.has(s.호차)) map.set(s.호차, []);
      map.get(s.호차)!.push(s);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([호차, list]) => {
        const busMeta = buses.find((b) => b.호차 === 호차);
        return {
          호차,
          students: list,
          guideName: busMeta?.인솔교사1,
          driverName: busMeta?.기사명,
        };
      });
  }, [students, buses]);

  const totalStats = useMemo(() => ({
    classes: classes.length,
    completed: classes.filter((c) => c.total > 0 && c.checked === c.total).length,
    total: students.length,
    checked: checkedIds.size,
  }), [classes, students.length, checkedIds.size]);

  const selectedClassData = selectedClass !== null
    ? classes.find((c) => c.반 === selectedClass) ?? null
    : null;

  const selectedBus = useMemo(
    () => (selectedClass !== null
      ? buses.find((b) => Number(b.탑승반) === selectedClass) ?? null
      : null),
    [buses, selectedClass],
  );

  const backHref = role === "admin" ? "/admin" : "/teacher";

  // 수동 탑승 toggle 핸들러
  async function handleSeatToggle(student: Student, isChecked: boolean) {
    if (!boardingSession || !user) return;
    if (isExpired) {
      toast.error("점호 시간이 만료되어 수정할 수 없습니다.");
      return;
    }
    if (working) return;
    setWorking(student.id);
    try {
      if (isChecked) {
        // 취소 확인 (실수 방지)
        if (!confirm(`${student.이름} 학생의 탑승을 취소할까요?`)) {
          setWorking(null);
          return;
        }
        const res = await undoManualCheckin({
          sessionId: boardingSession.id,
          studentId: student.id,
        });
        if (res.removed > 0) toast.success(`${student.이름} 탑승 취소됨`);
      } else {
        const res = await manualCheckin({
          sessionId: boardingSession.id,
          studentId: student.id,
          byUid: user.uid,
          busScanned: student.호차,
        });
        if (res.created) toast.success(`${student.이름} 수동 탑승 처리`);
        else toast.info("이미 탑승 처리된 학생입니다.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("permission-denied")) {
        toast.error("권한이 없습니다.");
      } else {
        toast.error("처리 실패. 다시 시도해주세요.");
      }
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const inBusView = view === "bus" && selectedClass === null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* 헤더 ←: 항상 홈으로 (selectedClass 와 무관) */}
          <Button size="sm" variant="ghost" className="text-gray-500 p-1"
            onClick={() => router.push(backHref)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">
              승차 현황{selectedClass !== null ? ` — ${selectedClass}반` : ""}
            </p>
            {boardingSession && (
              <p className="text-xs text-gray-400 truncate">
                {boardingSession.name} · 잔여 {remaining}
                {isExpired && <span className="text-red-500 ml-1">(만료)</span>}
              </p>
            )}
          </div>

          {/* 뷰 토글 — 반별/호차별, 최상위 화면에서만 표시 */}
          {selectedClass === null && boardingSession && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setView("class")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  view === "class" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                }`}>
                <LayoutGrid className="w-3 h-3" /> 반별
              </button>
              <button onClick={() => setView("bus")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  view === "bus" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                }`}>
                <Armchair className="w-3 h-3" /> 호차별
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {!boardingSession ? (
          <div className="text-center py-16 text-gray-400">
            <Bus className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">진행 중인 승차점호가 없습니다.</p>
          </div>
        ) : selectedClass !== null && selectedClassData ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedClass(null)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              전체 반 보기
            </button>

            {/* 버스 좌석 배치도 */}
            <BusSeatGrid
              busNumber={selectedBus?.호차 ?? selectedClass}
              students={selectedClassData.students}
              checkedIds={checkedIds}
              guideName={selectedBus?.인솔교사1}
              driverName={selectedBus?.기사명}
              onSeatClick={handleSeatToggle}
              disabled={isExpired || !!working}
            />

            {/* 미탑승 학생 연락처 */}
            {(() => {
              const unchecked = selectedClassData.students.filter((s) => !checkedIds.has(s.id));
              if (unchecked.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-500 px-1">
                    미탑승 {unchecked.length}명 연락처
                  </p>
                  {unchecked.map((student) => (
                    <div key={student.id} className="bg-white border border-red-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center text-xs font-bold text-red-500">
                          {student.번호}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{student.이름}</p>
                          <p className="text-xs text-gray-400">
                            {student.학년}학년 {student.반}반 {student.번호}번
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {student.학생연락처 ? (
                          <a href={`tel:${student.학생연락처.replace(/-/g, "")}`}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 py-2 rounded-lg font-medium">
                            <Phone className="w-3.5 h-3.5" /> 학생 {student.학생연락처}
                          </a>
                        ) : <div className="flex-1" />}
                        {student.보호자연락처 ? (
                          <a href={`tel:${student.보호자연락처.replace(/-/g, "")}`}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-lg font-medium">
                            <Phone className="w-3.5 h-3.5" /> 보호자 {student.보호자연락처}
                          </a>
                        ) : <div className="flex-1" />}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : inBusView ? (
          // ── 호차별 좌석 뷰 ─────────────────────────────────
          <div className="space-y-4">
            <div className={`rounded-2xl p-4 ${
              totalStats.checked === totalStats.total && totalStats.total > 0
                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                : "bg-gradient-to-r from-blue-600 to-indigo-600"
            }`}>
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <p className="font-bold text-sm">
                    {totalStats.checked === totalStats.total && totalStats.total > 0
                      ? "🎉 전체 승차 완료!"
                      : "호차별 좌석 보기"}
                  </p>
                  <p className="text-white/80 text-[11px] mt-0.5">
                    좌석을 탭하면 수동 탑승/취소 처리됩니다
                  </p>
                </div>
                <MiniDonut completed={totalStats.checked} total={totalStats.total}
                  size={56} stroke={6} color="#ffffff" />
              </div>
            </div>

            {busGroups.length === 0 ? (
              <p className="text-center text-gray-400 py-12">호차 정보가 없습니다.</p>
            ) : (
              busGroups.map((g) => (
                <BusSeatGrid
                  key={g.호차}
                  busNumber={g.호차}
                  students={g.students}
                  checkedIds={checkedIds}
                  guideName={g.guideName}
                  driverName={g.driverName}
                  disabled={isExpired || !!working}
                  onSeatClick={handleSeatToggle}
                />
              ))
            )}
          </div>
        ) : (
          // ── 반별 그리드 뷰 (기본) ────────────────────────
          <div className="space-y-4">
            <div className={`rounded-2xl p-4 ${
              totalStats.completed === totalStats.classes && totalStats.classes > 0
                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                : "bg-gradient-to-r from-blue-600 to-indigo-600"
            } shadow-md`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-bold text-sm">
                  {totalStats.completed === totalStats.classes && totalStats.classes > 0
                    ? "🎉 전체 승차 완료! 출발 가능"
                    : `${totalStats.completed}/${totalStats.classes}반 완료`}
                </p>
                <p className="text-white/80 text-sm font-medium">
                  {totalStats.checked}/{totalStats.total}명
                </p>
              </div>
              <div className="w-full bg-white/30 rounded-full h-2">
                <div className="bg-white h-2 rounded-full transition-all"
                  style={{ width: `${totalStats.total > 0 ? (totalStats.checked / totalStats.total) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {classes.map((c) => {
                const pct = c.total > 0 ? Math.round((c.checked / c.total) * 100) : 0;
                const isComplete = c.total > 0 && c.checked === c.total;
                const isEmpty = c.checked === 0;
                const isHomeroom = appUser?.담임반 === c.반;

                return (
                  <button key={c.반} onClick={() => setSelectedClass(c.반)}
                    className={`rounded-xl border-2 p-4 text-left transition-all active:scale-95 ${
                      isComplete ? "border-green-400 bg-green-50"
                        : isEmpty ? "border-red-300 bg-red-50"
                        : "border-amber-300 bg-amber-50"
                    } ${isHomeroom ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-gray-900 text-lg">{c.반}반</span>
                      {isComplete
                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : <MiniDonut completed={c.checked} total={c.total} size={36} stroke={4} showText={false} />}
                    </div>
                    <p className={`text-sm font-semibold ${
                      isComplete ? "text-green-600"
                        : isEmpty ? "text-red-500"
                        : "text-amber-600"
                    }`}>
                      {c.checked}/{c.total}명 ({pct}%)
                    </p>
                    {!isComplete && c.total > 0 && (
                      <p className="text-xs text-gray-400 mt-1">미승차 {c.total - c.checked}명 →</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
