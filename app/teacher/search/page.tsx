"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Search, User, Phone, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, Heart,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { subscribeStudents } from "@/lib/firestore";
import type { Student } from "@/types";

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

function StudentCard({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="pt-4 pb-3">
        <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600">
                {student.이름.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{student.이름}</span>
                  {student.요양호여부 && (
                    <Badge className="text-xs bg-red-50 text-red-600 border-red-200 py-0 px-1.5">요양호</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {student.학년}학년 {student.반}반 {student.번호}번
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-500">{student.호실}</p>
                <p className="text-xs text-gray-400">{student.호차}호차</p>
              </div>
              {expanded
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
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

  useEffect(() => { return subscribeStudents(setStudents); }, []);

  const filtered = useMemo(() => {
    let list = students;
    if (gradeFilter !== "전체") list = list.filter((s) => s.학년 === Number(gradeFilter));
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s) =>
        s.이름.includes(q) || String(s.학년).includes(q) ||
        String(s.반).includes(q) || String(s.번호).includes(q) || s.호실.includes(q)
      );
    }
    return list.sort((a, b) => a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호);
  }, [students, search, gradeFilter]);

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
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/teacher">
              <Button size="sm" variant="ghost" className="text-gray-500 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-bold text-gray-900">학생 검색</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 학년·반·번호, 호실 검색"
              className="pl-9 border-gray-300 text-gray-900 bg-white" autoFocus />
          </div>

          <div className="flex gap-1">
            {["전체", "1", "2", "3"].map((g) => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  gradeFilter === g
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {g === "전체" ? "전체" : `${g}학년`}
              </button>
            ))}
          </div>
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
