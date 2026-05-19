"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Search, CheckCircle2, Loader2, UserCheck,
  LayoutList, Hotel, Heart,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeStudents, subscribeSessionCheckins,
  manualCheckin, undoManualCheckin,
  getOpenSessions,
} from "@/lib/firestore";
import type { Student, Checkin, CheckinSession } from "@/types";
import { MiniDonut } from "@/components/mini-donut";

type FilterMode = "all" | "done" | "missing";
type ViewMode = "list" | "dorm";

// ── 리스트 뷰의 학생 한 행 ───────────────────────────────────
function StudentCheckinRow({ student, checked, onToggle, tapping }: {
  student: Student;
  checked: boolean;
  onToggle: (isChecked: boolean) => void;
  tapping: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
      checked ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          checked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
        }`}>
          {student.번호}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 leading-tight">{student.이름}</p>
          <p className="text-xs text-gray-400">
            {student.학년}-{student.반}-{student.번호} · {student.호실}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {checked ? (
          <button
            type="button"
            onClick={() => onToggle(true)}
            disabled={tapping}
            className="flex items-center gap-1 text-xs text-green-700 bg-white border border-green-300 hover:text-red-500 hover:border-red-300 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors"
            title="탭하여 취소"
          >
            {tapping
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <><CheckCircle2 className="w-3.5 h-3.5" /> 완료</>}
          </button>
        ) : (
          <Button size="sm" variant="outline"
            className="border-amber-300 text-amber-600 hover:bg-amber-50 h-8 px-3"
            onClick={() => onToggle(false)} disabled={tapping}>
            {tapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 침대 한 개 (객실 평면도 위에서 내려다본 모습) ───────────────
function DormBed({
  student, checked, onToggle, working, side,
}: {
  student: Student;
  checked: boolean;
  onToggle: (s: Student, isChecked: boolean) => void;
  working: string | null;
  side: "left" | "right";
}) {
  const isCaution = student.요양호여부 || !!student.건강요주의사항;
  const isWorking = working === student.id;

  return (
    <button
      type="button"
      onClick={() => !working && onToggle(student, checked)}
      disabled={isWorking}
      className={`w-full rounded-lg border overflow-hidden transition-all active:scale-95 ${
        checked
          ? "border-green-300 shadow-sm shadow-green-100"
          : "border-gray-200 hover:border-amber-300"
      }`}
    >
      {/* 헤드보드 + 매트리스 — side 에 따라 헤드보드 방향이 바뀜 */}
      <div className={`flex ${side === "right" ? "flex-row-reverse" : ""}`}>
        {/* 헤드보드 (벽 쪽) */}
        <div className={`w-3 shrink-0 ${checked ? "bg-green-500" : "bg-slate-300"}`} />
        {/* 매트리스 */}
        <div className={`flex-1 px-2 py-2 text-left ${checked ? "bg-green-50" : "bg-white"}`}>
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0">
              <p className={`text-xs font-bold truncate leading-tight ${
                checked ? "text-green-800" : "text-gray-900"
              }`}>{student.이름}</p>
              <p className={`text-[10px] leading-none mt-0.5 ${
                checked ? "text-green-600" : "text-gray-400"
              }`}>{student.번호}번</p>
            </div>
            {isWorking
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" />
              : checked
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                : isCaution
                  ? <Heart className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── 객실 평면도 카드 ────────────────────────────────────────────
function DormRoomCard({
  room, students, checkedIds, onToggle, working,
}: {
  room: string;
  students: Student[];
  checkedIds: Set<string>;
  onToggle: (s: Student, isChecked: boolean) => void;
  working: string | null;
}) {
  const sorted = [...students].sort((a, b) => a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호);
  const done = sorted.filter((s) => checkedIds.has(s.id)).length;
  const total = sorted.length;
  const isComplete = total > 0 && done === total;
  const floor = students[0]?.층;

  // 좌우 벽쪽 침대열 분배
  const half = Math.ceil(sorted.length / 2);
  const leftBeds = sorted.slice(0, half);
  const rightBeds = sorted.slice(half);

  return (
    <div className={`rounded-2xl border-2 overflow-hidden shadow-sm ${
      isComplete ? "border-green-300" : done === 0 ? "border-red-200" : "border-amber-200"
    }`}>
      {/* 객실 헤더 */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isComplete
          ? "bg-gradient-to-r from-green-50 to-emerald-50"
          : done === 0
            ? "bg-gradient-to-r from-red-50 to-rose-50"
            : "bg-gradient-to-r from-amber-50 to-orange-50"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isComplete ? "bg-green-500" : done === 0 ? "bg-red-400" : "bg-amber-400"
          }`}>
            <Hotel className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{room}호</p>
            {floor != null && <p className="text-xs text-gray-400">{floor}층</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isComplete
            ? <CheckCircle2 className="w-6 h-6 text-green-500" />
            : <MiniDonut completed={done} total={total} size={36} stroke={4} showText={false} />}
          <span className={`text-sm font-bold tabular-nums ${
            isComplete ? "text-green-600" : "text-amber-600"
          }`}>{done}/{total}</span>
        </div>
      </div>

      {/* 객실 평면도 — 위에서 내려다본 방 구조 */}
      <div className="bg-stone-100 p-3">
        <div className="border-[3px] border-stone-400 rounded-xl bg-stone-50 p-2.5">
          <div className="flex gap-2.5">
            {/* 왼쪽 벽 침대열 */}
            <div className="flex-1 space-y-1.5">
              {leftBeds.map((s) => (
                <DormBed key={s.id} student={s} checked={checkedIds.has(s.id)}
                  onToggle={onToggle} working={working} side="left" />
              ))}
            </div>
            {/* 중앙 통로 */}
            <div className="w-px bg-stone-300 self-stretch" />
            {/* 오른쪽 벽 침대열 */}
            <div className="flex-1 space-y-1.5">
              {rightBeds.map((s) => (
                <DormBed key={s.id} student={s} checked={checkedIds.has(s.id)}
                  onToggle={onToggle} working={working} side="right" />
              ))}
            </div>
          </div>
          {/* 출입구 표시 */}
          <div className="mt-2.5 flex justify-center">
            <div className="px-3 py-0.5 bg-stone-200 rounded text-[9px] text-stone-500 font-medium tracking-wide">
              출입구
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherCheckinContent() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [students, setStudents] = useState<Student[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [session, setSession] = useState<CheckinSession | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [classFilter, setClassFilter] = useState("전체");
  const [view, setView] = useState<ViewMode>("list");
  const [working, setWorking] = useState<string | null>(null);
  const [defaultSet, setDefaultSet] = useState(false);

  const isExpired = session
    ? session.endAt.toDate().getTime() <= Date.now()
    : false;

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  // 담임 학년/반 기본값 (최초 1회)
  useEffect(() => {
    if (defaultSet || !appUser) return;
    if (appUser.담임학년) setGradeFilter(String(appUser.담임학년));
    if (appUser.담임반) setClassFilter(String(appUser.담임반));
    setDefaultSet(true);
  }, [appUser, defaultSet]);

  // 정시점호일 때 호실별 뷰를 기본으로
  useEffect(() => {
    if (session?.type === "정시점호") setView("dorm");
  }, [session?.type]);

  useEffect(() => { return subscribeStudents(setStudents); }, []);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeSessionCheckins(sessionId, setCheckins);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    getOpenSessions().then((sessions) => {
      setSession(sessions.find((x) => x.id === sessionId) || null);
    });
  }, [sessionId]);

  const checkedIds = useMemo(() => {
    const set = new Set<string>();
    checkins.forEach((c) => set.add(c.studentRef.split("/").pop()!));
    return set;
  }, [checkins]);

  // 학년+반 필터 적용된 학생 목록
  const scopedStudents = useMemo(() => {
    let list = students;
    if (gradeFilter !== "전체") list = list.filter((s) => s.학년 === Number(gradeFilter));
    if (classFilter !== "전체") list = list.filter((s) => s.반 === Number(classFilter));
    return list;
  }, [students, gradeFilter, classFilter]);

  const stats = useMemo(() => ({
    total: scopedStudents.length,
    done: scopedStudents.filter((s) => checkedIds.has(s.id)).length,
    missing: scopedStudents.filter((s) => !checkedIds.has(s.id)).length,
  }), [scopedStudents, checkedIds]);

  // 호실별 그룹
  const rooms = useMemo(() => {
    const map = new Map<string, Student[]>();
    scopedStudents.forEach((s) => {
      const key = s.호실 || "(미배정)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries())
      .map(([room, list]) => {
        const done = list.filter((s) => checkedIds.has(s.id)).length;
        return {
          room,
          students: list,
          total: list.length,
          done,
          missing: list.length - done,
        };
      })
      .sort((a, b) => {
        // 미완료 → 완료 순, 같은 상태에선 호실 번호순
        const aFull = a.done === a.total;
        const bFull = b.done === b.total;
        if (aFull !== bFull) return aFull ? 1 : -1;
        return a.room.localeCompare(b.room, undefined, { numeric: true });
      });
  }, [scopedStudents, checkedIds]);

  const filtered = useMemo(() => {
    let list = scopedStudents;
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s) =>
        s.이름.includes(q) || String(s.학년).includes(q) ||
        String(s.반).includes(q) || String(s.번호).includes(q) ||
        s.호실.includes(q)
      );
    }
    if (filter === "done") list = list.filter((s) => checkedIds.has(s.id));
    if (filter === "missing") list = list.filter((s) => !checkedIds.has(s.id));
    return list.sort((a, b) => a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호);
  }, [scopedStudents, search, filter, checkedIds]);

  async function handleManualToggle(student: Student, isChecked: boolean) {
    if (!sessionId || !user) return;
    if (isExpired) {
      toast.error("점호 시간이 만료되어 수정할 수 없습니다.");
      return;
    }
    if (working) return;
    setWorking(student.id);
    try {
      if (isChecked) {
        if (!confirm(`${student.이름} 학생의 점호를 취소할까요?`)) {
          setWorking(null);
          return;
        }
        const res = await undoManualCheckin({ sessionId, studentId: student.id });
        if (res.removed > 0) toast.success(`${student.이름} 점호 취소됨`);
      } else {
        const res = await manualCheckin({
          sessionId, studentId: student.id, byUid: user.uid,
        });
        if (res.created) toast.success(`${student.이름} 직접 점호 완료`);
        else toast.info("이미 점호된 학생입니다.");
      }
    } catch {
      toast.error("처리 실패. 다시 시도해주세요.");
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Button size="sm" variant="ghost" className="text-gray-500 p-1"
              onClick={() => router.push(role === "admin" ? "/admin" : "/teacher")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{session?.name ?? "점호 현황"}</p>
              {session && (
                <p className="text-xs text-gray-400">
                  {session.type} · {session.scope}
                  {isExpired && <span className="text-red-500 ml-1">(만료)</span>}
                </p>
              )}
            </div>
            {/* 뷰 토글 */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
              <button onClick={() => setView("list")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  view === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                }`}>
                <LayoutList className="w-3 h-3" /> 리스트
              </button>
              <button onClick={() => setView("dorm")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  view === "dorm" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                }`}>
                <Hotel className="w-3 h-3" /> 방
              </button>
            </div>
          </div>

          {/* 통계 + 진행률 도넛 */}
          <div className="flex items-center gap-3 mb-3">
            <MiniDonut completed={stats.done} total={stats.total} size={56} stroke={6} />
            <div className="flex-1 grid grid-cols-3 gap-2">
              {[
                { label: "전체", val: stats.total, color: "text-gray-700" },
                { label: "완료", val: stats.done, color: "text-green-600" },
                { label: "미완", val: stats.missing, color: "text-amber-600" },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-gray-100 rounded-xl py-2 text-center">
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{val}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 검색 */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 학년·반·번호, 호실 검색"
              className="pl-9 border-gray-300 text-gray-900 bg-white" />
          </div>

          {/* 다른 반 빠른 접근 — 담임반으로 자동 필터된 경우만 표시 */}
          {(gradeFilter !== "전체" || classFilter !== "전체") && (
            <button
              type="button"
              onClick={() => { setGradeFilter("전체"); setClassFilter("전체"); }}
              className="mb-2 text-xs text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2"
            >
              다른 반·전체 학년 보기
            </button>
          )}

          {/* 학년 필터 */}
          <div className="flex gap-1 mb-2">
            {["전체", "1", "2", "3"].map((g) => (
              <button key={g} onClick={() => { setGradeFilter(g); setClassFilter("전체"); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  gradeFilter === g
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {g === "전체" ? "전체" : `${g}학년`}
              </button>
            ))}
          </div>

          {/* 반 필터 */}
          <div className="flex flex-wrap gap-1 mb-2">
            {["전체", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((c) => (
              <button key={c} onClick={() => setClassFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  classFilter === c
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {c === "전체" ? "전체" : `${c}반`}
              </button>
            ))}
          </div>

          {/* 상태 필터 탭 (리스트 뷰에서만) */}
          {view === "list" && (
            <div className="flex gap-1">
              {(["all", "missing", "done"] as FilterMode[]).map((m) => (
                <button key={m} onClick={() => setFilter(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === m
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {m === "all" ? "전체" : m === "done" ? "완료" : "미완료"}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {view === "dorm" ? (
          rooms.length === 0 ? (
            <p className="text-center text-gray-400 py-8">표시할 호실이 없습니다.</p>
          ) : (
            rooms.map((r) => (
              <DormRoomCard key={r.room}
                room={r.room}
                students={r.students}
                checkedIds={checkedIds}
                onToggle={handleManualToggle}
                working={working}
              />
            ))
          )
        ) : (
          filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((s) => (
              <StudentCheckinRow key={s.id} student={s} checked={checkedIds.has(s.id)}
                onToggle={(isChecked) => handleManualToggle(s, isChecked)} tapping={working === s.id} />
            ))
          )
        )}
      </main>
    </div>
  );
}

export default function TeacherCheckinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    }>
      <TeacherCheckinContent />
    </Suspense>
  );
}
