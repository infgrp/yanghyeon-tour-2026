"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hotel, Phone, ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { subscribeStudents } from "@/lib/firestore";
import type { Student } from "@/types";

function RoomCard({ 호실, students }: { 호실: string; students: Student[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Hotel className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">{호실}호</p>
            <p className="text-xs text-gray-400">{students[0]?.층}층 · {students.length}명</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {students.slice(0, 4).map((s) => (
              <div key={s.id}
                className="w-6 h-6 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[10px] font-bold text-indigo-600">
                {s.이름.charAt(0)}
              </div>
            ))}
            {students.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[10px] text-gray-500">
                +{students.length - 4}
              </div>
            )}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {students.map((student) => (
            <div key={student.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                  {student.번호}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{student.이름}</p>
                  <p className="text-xs text-gray-400">
                    {student.학년}학년 {student.반}반 {student.번호}번
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {student.학생연락처 ? (
                  <a href={`tel:${student.학생연락처.replace(/-/g, "")}`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 py-1.5 rounded-lg font-medium">
                    <Phone className="w-3 h-3" /> {student.학생연락처}
                  </a>
                ) : <div className="flex-1" />}
                {student.보호자연락처 ? (
                  <a href={`tel:${student.보호자연락처.replace(/-/g, "")}`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 py-1.5 rounded-lg font-medium">
                    <Phone className="w-3 h-3" /> {student.보호자연락처}
                  </a>
                ) : <div className="flex-1" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherRoomsPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  useEffect(() => { return subscribeStudents(setStudents); }, []);

  // 담임 학생만 필터링
  const myStudents = useMemo(() => {
    let list = students;
    if (appUser?.담임학년) list = list.filter((s) => s.학년 === appUser.담임학년);
    if (appUser?.담임반) list = list.filter((s) => s.반 === appUser.담임반);
    return list;
  }, [students, appUser]);

  // 호실별 그룹핑
  const rooms = useMemo(() => {
    const map = new Map<string, Student[]>();
    myStudents.forEach((s) => {
      if (!map.has(s.호실)) map.set(s.호실, []);
      map.get(s.호실)!.push(s);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([호실, list]) => ({
        호실,
        students: list.sort((a, b) => a.번호 - b.번호),
      }));
  }, [myStudents]);

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
          <Button size="sm" variant="ghost" className="text-gray-500 p-1"
            onClick={() => router.push("/teacher")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="font-bold text-gray-900">숙소 배정</p>
            {appUser?.담임반 && (
              <p className="text-xs text-gray-400">
                {appUser.담임학년 ? `${appUser.담임학년}학년 ` : ""}{appUser.담임반}반 · {myStudents.length}명
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {!appUser?.담임반 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>담임 정보가 설정되지 않았습니다.</p>
            <p className="text-xs mt-1">관리자에게 담임 정보 동기화를 요청하세요.</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Hotel className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>배정된 호실 정보가 없습니다.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 pb-1">{rooms.length}개 호실</p>
            {rooms.map((r) => (
              <RoomCard key={r.호실} 호실={r.호실} students={r.students} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
