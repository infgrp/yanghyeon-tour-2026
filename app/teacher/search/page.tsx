"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Search, User, Phone, AlertTriangle,
  Loader2, ChevronDown, Heart, KeyRound, Mail, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { subscribeStudents } from "@/lib/firestore";
import { lookupStudentAccount, sendStudentPasswordReset } from "@/lib/auth";
import type { Student } from "@/types";

function StudentAccountSection({ student }: { student: Student }) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    lookupStudentAccount(student.학년, student.반, student.번호)
      .then((res) => {
        if (cancelled) return;
        if (!res || !res.uid) {
          setJoined(false);
          setEmail(null);
        } else {
          setJoined(true);
          setEmail(res.email);
        }
      })
      .catch(() => {
        if (!cancelled) { setJoined(false); setEmail(null); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student.학년, student.반, student.번호]);

  async function handleCopyEmail() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      toast.success("이메일이 복사되었습니다.");
    } catch {
      toast.error("복사 실패. 직접 선택해 복사해주세요.");
    }
  }

  async function handleSendReset() {
    if (!email) return;
    if (!confirm(`${student.이름} 학생(${email})에게 비밀번호 재설정 이메일을 발송할까요?\n\n학생이 받은편지함에서 링크를 눌러 새 비밀번호를 설정합니다.`)) return;
    setSending(true);
    try {
      await sendStudentPasswordReset(email);
      toast.success("재설정 이메일을 발송했습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("user-not-found")) {
        toast.error("Auth 계정을 찾을 수 없습니다.");
      } else {
        toast.error("발송 실패: " + msg);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
        <p className="text-xs font-semibold text-blue-800">가입 정보</p>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400">조회 중...</p>
      ) : !joined ? (
        <p className="text-xs text-gray-600">아직 가입하지 않은 학생입니다.</p>
      ) : !email ? (
        <p className="text-xs text-amber-700">가입은 되어 있으나 이메일 정보가 없습니다. 관리자에게 backfill 요청.</p>
      ) : (
        <>
          <div className="flex items-center justify-between bg-white border border-blue-200 rounded-md px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-xs text-gray-800 font-mono truncate">{email}</span>
            </div>
            <button type="button" onClick={handleCopyEmail}
              className="text-blue-600 hover:text-blue-800 p-1 shrink-0"
              title="이메일 복사">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
            onClick={handleSendReset} disabled={sending}>
            {sending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
            비밀번호 재설정 이메일 발송
          </Button>
          <p className="text-[10px] text-gray-500 leading-tight">
            학생이 본인 이메일을 못 보는 경우 관리자에게 임시 비밀번호 설정을 요청하세요.
          </p>
        </>
      )}
    </div>
  );
}

function StudentDetail({ student }: { student: Student }) {
  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { label: "호실", value: `${student.호실} (${student.층}층)` },
          { label: "호차", value: `${student.호차}호차` },
          { label: "비행편", value: student.비행편 || "-" },
          { label: "잔류여부", value: student.잔류여부 ? "잔류" : "-" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="font-medium text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      <StudentAccountSection student={student} />

      {(student.학생연락처 || student.보호자연락처) && (
        <div className="space-y-1.5">
          {student.학생연락처 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">학생 연락처</span>
              <a href={`tel:${student.학생연락처.replace(/-/g, "")}`}
                className="flex items-center gap-1.5 text-green-700 text-xs bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
                <Phone className="w-3 h-3" />{student.학생연락처}
              </a>
            </div>
          )}
          {student.보호자연락처 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">보호자 연락처</span>
              <a href={`tel:${student.보호자연락처.replace(/-/g, "")}`}
                className="flex items-center gap-1.5 text-blue-700 text-xs bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                <Phone className="w-3 h-3" />{student.보호자연락처}
              </a>
            </div>
          )}
        </div>
      )}

      {student.건강요주의사항 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-2">
          <Heart className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 mb-0.5">건강 요주의</p>
            <p className="text-xs text-amber-600">{student.건강요주의사항}</p>
          </div>
        </div>
      )}

      {student.특이사항 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-purple-700 mb-0.5">특이사항</p>
            <p className="text-xs text-purple-600">{student.특이사항}</p>
          </div>
        </div>
      )}

      {student.요양호여부 && (
        <Badge className="bg-red-50 text-red-600 border-red-200">요양호 대상</Badge>
      )}
    </div>
  );
}

// 학년별 아바타 배경색 — 시각적 구분
function avatarStyle(학년: number, 반: number) {
  const palette = [
    { bg: "bg-blue-100", text: "text-blue-700" },
    { bg: "bg-purple-100", text: "text-purple-700" },
    { bg: "bg-emerald-100", text: "text-emerald-700" },
    { bg: "bg-amber-100", text: "text-amber-700" },
    { bg: "bg-rose-100", text: "text-rose-700" },
    { bg: "bg-cyan-100", text: "text-cyan-700" },
  ];
  return palette[(학년 * 7 + 반) % palette.length];
}

function StudentCard({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);
  const avatar = avatarStyle(student.학년, student.반);
  const isCaution = student.요양호여부 || !!student.건강요주의사항;

  return (
    <Card className={`bg-white shadow-sm transition-all duration-200 cursor-pointer ${
      expanded
        ? "border-blue-300 shadow-md ring-2 ring-blue-100"
        : "border-gray-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
    }`}>
      <CardContent className="pt-4 pb-3">
        <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`relative w-11 h-11 rounded-full ${avatar.bg} flex items-center justify-center text-base font-bold ${avatar.text} ring-2 ring-white shadow-sm`}>
                {student.이름.charAt(0)}
                {isCaution && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full ring-2 ring-white flex items-center justify-center">
                    <Heart className="w-2 h-2 text-white" fill="white" />
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-gray-900">{student.이름}</span>
                  {student.요양호여부 && (
                    <Badge className="text-[10px] bg-red-50 text-red-600 border-red-200 py-0 px-1.5 leading-tight">요양호</Badge>
                  )}
                  {student.잔류여부 && (
                    <Badge className="text-[10px] bg-gray-100 text-gray-600 border-gray-300 py-0 px-1.5 leading-tight">잔류</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono">{student.학년}-{student.반}-{student.번호}</span>
                  <span className="ml-1.5">{student.학년}학년 {student.반}반 {student.번호}번</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <p className="text-xs text-gray-700 font-semibold">{student.호실}</p>
                <p className="text-[11px] text-gray-400">{student.호차}호차</p>
              </div>
              <div className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </button>
        {expanded && <StudentDetail student={student} />}
      </CardContent>
    </Card>
  );
}

export default function TeacherSearchPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [classFilter, setClassFilter] = useState("전체");
  const [defaultSet, setDefaultSet] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  // 담임 학년/반 기본값 설정 (최초 1회)
  useEffect(() => {
    if (defaultSet || !appUser) return;
    if (appUser.담임학년) setGradeFilter(String(appUser.담임학년));
    if (appUser.담임반) setClassFilter(String(appUser.담임반));
    setDefaultSet(true);
  }, [appUser, defaultSet]);

  useEffect(() => { return subscribeStudents(setStudents); }, []);

  // 학생 데이터에 실제로 존재하는 학년 목록
  const availableGrades = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.학년))).sort((a, b) => a - b);
  }, [students]);

  // 현재 선택된 학년에 존재하는 반 목록 + 각 반의 학생 수
  const availableClasses = useMemo(() => {
    const list = gradeFilter === "전체"
      ? students
      : students.filter((s) => s.학년 === Number(gradeFilter));
    const counts = new Map<number, number>();
    list.forEach((s) => counts.set(s.반, (counts.get(s.반) ?? 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([반, count]) => ({ 반, count }));
  }, [students, gradeFilter]);

  // 학년 변경 시 현재 classFilter가 새 학년에 존재하지 않으면 "전체"로 리셋
  useEffect(() => {
    if (classFilter === "전체") return;
    const exists = availableClasses.some((c) => String(c.반) === classFilter);
    if (!exists) setClassFilter("전체");
  }, [availableClasses, classFilter]);

  const filtered = useMemo(() => {
    let list = students;
    if (gradeFilter !== "전체") list = list.filter((s) => s.학년 === Number(gradeFilter));
    if (classFilter !== "전체") list = list.filter((s) => s.반 === Number(classFilter));
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s) =>
        s.이름.includes(q) || String(s.학년).includes(q) ||
        String(s.반).includes(q) || String(s.번호).includes(q) || s.호실.includes(q)
      );
    }
    return list.sort((a, b) => a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호);
  }, [students, search, gradeFilter, classFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" className="text-gray-500 p-1"
              onClick={() => router.push(role === "admin" ? "/admin" : "/teacher")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-bold text-gray-900">학생 검색</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 학년·반·번호, 호실 검색"
              className="pl-9 border-gray-300 text-gray-900 bg-white" autoFocus />
          </div>

          {/* 학년 필터 — 학생 데이터에 존재하는 학년만 표시 */}
          <div className="flex gap-1">
            <button onClick={() => setGradeFilter("전체")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                gradeFilter === "전체"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              전체
            </button>
            {availableGrades.map((g) => (
              <button key={g} onClick={() => setGradeFilter(String(g))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  gradeFilter === String(g)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {g}학년
              </button>
            ))}
          </div>

          {/* 반 필터 — 현재 학년에 존재하는 반만 + 학생 수 표시 */}
          {availableClasses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setClassFilter("전체")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  classFilter === "전체"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                전체
              </button>
              {availableClasses.map(({ 반, count }) => (
                <button key={반} onClick={() => setClassFilter(String(반))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    classFilter === String(반)
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {반}반
                  <span className={`ml-1 text-[10px] ${
                    classFilter === String(반) ? "text-indigo-100" : "text-gray-400"
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        <p className="text-xs text-gray-400 pb-1">{filtered.length}명 표시</p>
        {filtered.map((s) => <StudentCard key={s.id} student={s} />)}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
