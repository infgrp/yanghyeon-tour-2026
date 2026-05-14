"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Search, CheckCircle2, Loader2, UserCheck,
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

function StudentCheckinRow({ student, checked, onTap, tapping }: {
  student: Student;
  checked: boolean;
  onTap: () => void;
  tapping: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border p-3 ${
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
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Button size="sm" variant="outline"
            className="border-amber-300 text-amber-600 hover:bg-amber-50 h-8 px-3"
            onClick={onTap} disabled={tapping}>
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

  const filtered = useMemo(() => {
    let list = students;
    if (gradeFilter !== "전체") list = list.filter((s) => s.학년 === Number(gradeFilter));
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s) =>
        s.이름.includes(q) || String(s.학년).includes(q) ||
        String(s.반).includes(q) || String(s.번호).includes(q)
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
      await createCheckin({ sessionId, studentId: student.id, method: "TEACHER_TAP", byUid: user.uid });
      toast.success(`${student.이름} 점호 처리 완료`);
    } catch { toast.error("점호 처리 실패"); }
    finally { setTappingId(null); }
  }

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
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/teacher">
              <Button size="sm" variant="ghost" className="text-gray-500 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{session?.name ?? "점호 현황"}</p>
              {session && (
                <p className="text-xs text-gray-400">{session.type} · {session.scope}</p>
              )}
            </div>
          </div>

          {/* 통계 바 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "전체", val: stats.total, color: "text-gray-700" },
              { label: "완료", val: stats.done, color: "text-green-600" },
              { label: "미완", val: stats.missing, color: "text-amber-600" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-gray-100 rounded-xl py-2 text-center">
                <p className={`text-xl font-bold ${color}`}>{val}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          {/* 진행률 */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: stats.total > 0 ? `${(stats.done / stats.total) * 100}%` : "0%" }} />
          </div>

          {/* 검색/필터 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 학년·반·번호 검색"
                className="pl-9 border-gray-300 text-gray-900 bg-white" />
            </div>
            <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v ?? "전체")}>
              <SelectTrigger className="w-20 border-gray-300 text-gray-900 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">검색 결과가 없습니다.</p>
        ) : (
          filtered.map((s) => (
            <StudentCheckinRow key={s.id} student={s} checked={checkedIds.has(s.id)}
              onTap={() => handleTeacherTap(s)} tapping={tappingId === s.id} />
          ))
        )}
      </main>
    </div>
  );
}
