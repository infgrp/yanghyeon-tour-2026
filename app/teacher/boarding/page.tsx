"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Bus, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeStudents, subscribeOpenSessions, subscribeSessionCheckins,
} from "@/lib/firestore";
import type { Student, CheckinSession, Checkin } from "@/types";

function timeLeft(session: CheckinSession): string {
  const diff = session.endAt.toDate().getTime() - Date.now();
  if (diff <= 0) return "마감";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ClassDetail({
  classNum, students, checkedIds,
}: {
  classNum: number;
  students: Student[];
  checkedIds: Set<string>;
}) {
  const unchecked = students.filter((s) => !checkedIds.has(s.id));
  const checkedCount = students.length - unchecked.length;

  if (unchecked.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
        <p className="font-bold text-green-600 text-xl">전원 승차 완료!</p>
        <p className="text-sm text-gray-400 mt-1">{students.length}명 모두 탑승했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-red-500">미승차 {unchecked.length}명</p>
        <p className="text-sm text-green-600">승차완료 {checkedCount}명</p>
      </div>
      {unchecked.map((student) => (
        <div key={student.id}
          className="bg-white border border-red-200 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center text-xs font-bold text-red-500">
              {student.번호}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{student.이름}</p>
              <p className="text-xs text-gray-400">
                {student.학년}학년 {student.반}반 {student.번호}번 · {student.호실}
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
      <p className="text-xs text-gray-400 text-center pt-2">
        {classNum}반 · 전체 {students.length}명
      </p>
    </div>
  );
}

export default function BoardingPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<CheckinSession[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [remaining, setRemaining] = useState("");

  const boardingSession = useMemo(
    () => sessions.find((s) => s.type === "승차점호") ?? null,
    [sessions]
  );

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  // 담임반 자동 선택 (교사)
  useEffect(() => {
    if (appUser?.담임반 && selectedClass === null) {
      setSelectedClass(appUser.담임반);
    }
  }, [appUser, selectedClass]);

  useEffect(() => { return subscribeStudents(setStudents); }, []);
  useEffect(() => { return subscribeOpenSessions(setSessions); }, []);

  useEffect(() => {
    if (!boardingSession) { setCheckins([]); return; }
    return subscribeSessionCheckins(boardingSession.id, setCheckins);
  }, [boardingSession?.id]);

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

  const totalStats = useMemo(() => ({
    classes: classes.length,
    completed: classes.filter((c) => c.total > 0 && c.checked === c.total).length,
    total: students.length,
    checked: checkedIds.size,
  }), [classes, students.length, checkedIds.size]);

  const selectedClassData = selectedClass !== null
    ? classes.find((c) => c.반 === selectedClass) ?? null
    : null;

  const backHref = role === "admin" ? "/admin" : "/teacher";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {selectedClass !== null ? (
            <Button size="sm" variant="ghost" className="text-gray-500 p-1"
              onClick={() => setSelectedClass(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <Link href={backHref}>
              <Button size="sm" variant="ghost" className="text-gray-500 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">
              {selectedClass !== null ? `${selectedClass}반 미승차 학생` : "승차 현황"}
            </p>
            {boardingSession && (
              <p className="text-xs text-gray-400 truncate">
                {boardingSession.name} · 잔여 {remaining}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {!boardingSession ? (
          <div className="text-center py-16 text-gray-400">
            <Bus className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">진행 중인 승차점호가 없습니다.</p>
          </div>
        ) : selectedClass !== null && selectedClassData ? (
          <ClassDetail
            classNum={selectedClass}
            students={selectedClassData.students}
            checkedIds={checkedIds}
          />
        ) : (
          <div className="space-y-4">
            {/* 전체 요약 */}
            <div className={`rounded-2xl p-4 ${
              totalStats.completed === totalStats.classes && totalStats.classes > 0
                ? "bg-green-500"
                : "bg-blue-600"
            }`}>
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

            {/* 반별 그리드 */}
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
                        : <span className="text-xs font-medium text-gray-500">{pct}%</span>}
                    </div>
                    <p className={`text-sm font-semibold ${
                      isComplete ? "text-green-600"
                        : isEmpty ? "text-red-500"
                        : "text-amber-600"
                    }`}>
                      {c.checked}/{c.total}명
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div className={`h-1.5 rounded-full transition-all ${
                        isComplete ? "bg-green-500"
                          : isEmpty ? "bg-red-400"
                          : "bg-amber-400"
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    {!isComplete && c.total > 0 && (
                      <p className="text-xs text-gray-400 mt-1.5">미승차 {c.total - c.checked}명 →</p>
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
