"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Search, User, Bus, Hotel, Phone, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, Heart,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { subscribeStudents } from "@/lib/firestore";
import type { Student } from "@/types";

function StudentDetail({ student }: { student: Student }) {
  return (
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-xs text-slate-500 mb-0.5">호실</p>
          <p className="font-medium">{student.호실} ({student.층}층)</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-xs text-slate-500 mb-0.5">호차</p>
          <p className="font-medium">{student.호차}호차</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-xs text-slate-500 mb-0.5">비행편</p>
          <p className="font-medium">{student.비행편 || "-"}</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <p className="text-xs text-slate-500 mb-0.5">잔류여부</p>
          <p className="font-medium">{student.잔류여부 ? "잔류" : "-"}</p>
        </div>
      </div>

      {(student.학생연락처 || student.보호자연락처) && (
        <div className="space-y-1.5">
          {student.학생연락처 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">학생 연락처</span>
              <a href={`tel:${student.학생연락처.replace(/-/g, "")}`}
                className="flex items-center gap-1.5 text-green-300 text-xs bg-green-900/30 px-2 py-1 rounded">
                <Phone className="w-3 h-3" />{student.학생연락처}
              </a>
            </div>
          )}
          {student.보호자연락처 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">보호자 연락처</span>
              <a href={`tel:${student.보호자연락처.replace(/-/g, "")}`}
                className="flex items-center gap-1.5 text-blue-300 text-xs bg-blue-900/30 px-2 py-1 rounded">
                <Phone className="w-3 h-3" />{student.보호자연락처}
              </a>
            </div>
          )}
        </div>
      )}

      {student.건강요주의사항 && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-2 flex gap-2">
          <Heart className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-300 mb-0.5">건강 요주의</p>
            <p className="text-xs text-amber-200">{student.건강요주의사항}</p>
          </div>
        </div>
      )}

      {student.특이사항 && (
        <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-2 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-purple-300 mb-0.5">특이사항</p>
            <p className="text-xs text-purple-200">{student.특이사항}</p>
          </div>
        </div>
      )}

      {student.요양호여부 && (
        <Badge className="bg-red-900/40 text-red-300 border-red-700">요양호 대상</Badge>
      )}
    </div>
  );
}

function StudentCard({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="pt-4 pb-3">
        <button
          className="w-full text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                {student.이름.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{student.이름}</span>
                  {student.요양호여부 && (
                    <Badge className="text-xs bg-red-900/40 text-red-300 border-red-700 py-0 px-1.5">요양호</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {student.학년}학년 {student.반}반 {student.번호}번
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-slate-400">{student.호실}</p>
                <p className="text-xs text-slate-500">{student.호차}호차</p>
              </div>
              {expanded
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>
        </button>

        {expanded && <StudentDetail student={student} />}
      </CardContent>
    </Card>
  );
}

export default function TeacherSearchPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("전체");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  useEffect(() => {
    const unsub = subscribeStudents(setStudents);
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = students;
    if (gradeFilter !== "전체") {
      list = list.filter((s) => s.학년 === Number(gradeFilter));
    }
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s) =>
        s.이름.includes(q) ||
        String(s.학년).includes(q) ||
        String(s.반).includes(q) ||
        String(s.번호).includes(q) ||
        s.호실.includes(q)
      );
    }
    return list.sort((a, b) => a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호);
  }, [students, search, gradeFilter]);

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
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/teacher">
              <Button size="sm" variant="ghost" className="text-slate-400 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-bold">학생 검색</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 학년·반·번호, 호실 검색"
              className="pl-9 bg-slate-800 border-slate-600 text-slate-100"
              autoFocus
            />
          </div>

          {/* 학년 필터 */}
          <div className="flex gap-1">
            {["전체", "1", "2", "3"].map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors
                  ${gradeFilter === g
                    ? "bg-blue-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                {g === "전체" ? "전체" : `${g}학년`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        <p className="text-xs text-slate-500 pb-1">{filtered.length}명 표시</p>
        {filtered.map((s) => (
          <StudentCard key={s.id} student={s} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
