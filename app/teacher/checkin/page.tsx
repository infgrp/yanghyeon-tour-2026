"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Search, CheckCircle2, XCircle, Clock, Loader2,
  UserCheck, Filter,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeStudents, subscribeSessionCheckins, createCheckin,
  getOpenSessions,
} from "@/lib/firestore";
import type { Student, Checkin, CheckinSession } from "@/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type FilterMode = "all" | "done" | "missing";

function statusColor(done: boolean) {
  return done
    ? "border-green-700 bg-green-900/20"
    : "border-slate-700 bg-slate-900";
}

// ── 학생 점호 카드 ───────────────────────────────────────────────
function StudentCheckinRow({ student, checked, onTap, tapping }: {
  student: Student;
  checked: boolean;
  onTap: () => void;
  tapping: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${statusColor(checked)}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${checked ? "bg-green-700 text-green-100" : "bg-slate-700 text-slate-300"}`}>
          {student.번호}
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{student.이름}</p>
          <p className="text-xs text-slate-400">
            {student.학년}-{student.반}-{student.번호} · {student.호실}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {checked ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-700 text-amber-300 h-8 px-3"
            onClick={onTap}
            disabled={tapping}
          >
            {tapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TeacherCheckinPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [students, setStudents] = useState<Student[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [session, setSession] = useState<CheckinSession | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [tappingId, setTappingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  useEffect(() => {
    const unsub = subscribeStudents(setStudents);
    return unsub;
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeSessionCheckins(sessionId, setCheckins);
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    getOpenSessions().then((sessions) => {
      const s = sessions.find((x) => x.id === sessionId);
      setSession(s || null);
    });
  }, [sessionId]);

  const checkedIds = useMemo(() => {
    const set = new Set<string>();
    checkins.forEach((c) => {
      const id = c.studentRef.split("/").pop()!;
      set.add(id);
    });
    return set;
  }, [checkins]);

  const filtered = useMemo(() => {
    let list = students;
    if (gradeFilter !== "전체") {
      const g = Number(gradeFilter);
      list = list.filter((s) => s.학년 === g);
    }
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s) =>
        s.이름.includes(q) ||
        String(s.학년).includes(q) ||
        String(s.반).includes(q) ||
        String(s.번호).includes(q)
      );
    }
    if (filter === "done") list = list.filter((s) => checkedIds.has(s.id));
    if (filter === "missing") list = list.filter((s) => !checkedIds.has(s.id));
    return list.sort((a, b) => a.반 - b.반 || a.번호 - b.번호);
  }, [students, search, filter, gradeFilter, checkedIds]);

  const stats = useMemo(() => ({
    total: students.length,
    done: checkedIds.size,
    missing: students.length - checkedIds.size,
  }), [students.length, checkedIds.size]);

  async function handleTeacherTap(student: Student) {
    if (!sessionId || !user) return;
    setTappingId(student.id);
    try {
      await createCheckin({
        sessionId,
        studentId: student.id,
        method: "TEACHER_TAP",
        byUid: user.uid,
      });
      toast.success(`${student.이름} 점호 처리 완료`);
    } catch {
      toast.error("점호 처리 실패");
    } finally {
      setTappingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/teacher">
              <Button size="sm" variant="ghost" className="text-slate-400 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{session?.name ?? "점호 현황"}</p>
              {session && (
                <p className="text-xs text-slate-400">{session.type} · {session.scope}</p>
              )}
            </div>
          </div>

          {/* 통계 바 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "전체", val: stats.total, color: "text-slate-300" },
              { label: "완료", val: stats.done, color: "text-green-400" },
              { label: "미완", val: stats.missing, color: "text-amber-400" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-slate-800 rounded-lg py-2 text-center">
                <p className={`text-xl font-bold ${color}`}>{val}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {/* 진행률 */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mb-3">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: stats.total > 0 ? `${(stats.done / stats.total) * 100}%` : "0%" }}
            />
          </div>

          {/* 검색/필터 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 학년·반·번호 검색"
                className="pl-9 bg-slate-800 border-slate-600 text-slate-100"
              />
            </div>
            <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "")}>
              <SelectTrigger className="w-20 bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="전체">전체</SelectItem>
                <SelectItem value="1">1학년</SelectItem>
                <SelectItem value="2">2학년</SelectItem>
                <SelectItem value="3">3학년</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 상태 필터 탭 */}
          <div className="flex gap-1 mt-2">
            {(["all", "missing", "done"] as FilterMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors
                  ${filter === m
                    ? "bg-blue-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                {m === "all" ? "전체" : m === "done" ? "완료" : "미완료"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-8">검색 결과가 없습니다.</p>
        ) : (
          filtered.map((s) => (
            <StudentCheckinRow
              key={s.id}
              student={s}
              checked={checkedIds.has(s.id)}
              onTap={() => handleTeacherTap(s)}
              tapping={tappingId === s.id}
            />
          ))
        )}
      </main>
    </div>
  );
}
