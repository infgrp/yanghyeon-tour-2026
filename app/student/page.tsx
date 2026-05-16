"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User, Bus, Hotel, Plane, CheckCircle2, Clock, Phone,
  AlertTriangle, LogOut, QrCode, Loader2, Calendar, MessageCircle, Heart,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/auth";
import { getStudent, subscribeOpenSessions, getStudentTodayCheckins, createCheckin, getPublicContacts } from "@/lib/firestore";
import type { Student, CheckinSession, Checkin, Contact } from "@/types";
import { FadeStaggerContainer, FadeStaggerItem } from "@/components/motion-presets";
import { StudentPageSkeleton } from "@/components/ui/skeleton";

function sessionApplies(session: CheckinSession, student: Student): boolean {
  const scope = session.scope;
  if (scope === "전체") return true;
  if (scope.startsWith("학급:")) {
    const n = Number(scope.split(":")[1]);
    return student.반 === n;
  }
  if (scope.startsWith("호실:")) {
    return student.호실 === scope.split(":")[1];
  }
  if (scope.startsWith("호차:")) {
    return student.호차 === Number(scope.split(":")[1]);
  }
  return false;
}

function timeUntil(ts: { toDate: () => Date }): string {
  const diff = ts.toDate().getTime() - Date.now();
  if (diff <= 0) return "마감";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}분 ${s}초`;
}

// ── 점호 카드 ────────────────────────────────────────────────────
function CheckinCard({
  session, student, uid, checkins,
}: {
  session: CheckinSession;
  student: Student;
  uid: string;
  checkins: Checkin[];
}) {
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(timeUntil(session.endAt));

  useEffect(() => {
    const id = setInterval(() => setRemaining(timeUntil(session.endAt)), 1000);
    return () => clearInterval(id);
  }, [session.endAt]);

  const alreadyChecked = checkins.some(
    (c) => c.sessionRef === `/checkin_sessions/${session.id}`
  );
  const isBus = session.type === "승차점호";

  async function handleSelfTap() {
    if (isBus) return;
    setBusy(true);
    try {
      await createCheckin({
        sessionId: session.id,
        studentId: student.id,
        method: "SELF_TAP",
        byUid: uid,
      });
      toast.success("점호 완료!");
    } catch {
      toast.error("점호 실패. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`border rounded-2xl p-4 space-y-3 transition-colors ${
      alreadyChecked
        ? "border-green-200 bg-green-50/40"
        : "border-amber-200 bg-amber-50/40"
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm text-gray-900">{session.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {session.type} · {session.scope}
          </p>
        </div>
        <Badge
          variant="outline"
          className={alreadyChecked
            ? "border-green-400 text-green-600 bg-white"
            : "border-amber-400 text-amber-600 bg-white"}
        >
          {alreadyChecked ? "완료" : remaining}
        </Badge>
      </div>

      {alreadyChecked ? (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>점호가 완료되었습니다.</span>
        </div>
      ) : isBus ? (
        <Link href="/student/qr">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            <QrCode className="w-4 h-4 mr-2" />
            QR 스캔으로 승차 확인
          </Button>
        </Link>
      ) : (
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleSelfTap} disabled={busy}>
          {busy
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : <CheckCircle2 className="w-4 h-4 mr-2" />}
          점호 확인
        </Button>
      )}
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function StudentPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<CheckinSession[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "student") {
      router.replace(role === "admin" ? "/admin" : "/teacher");
      return;
    }
  }, [user, role, loading, router]);

  const loadData = useCallback(async () => {
    if (!appUser?.studentRef || !user) return;
    try {
      const studentId = appUser.studentRef.split("/").pop()!;
      const [s, c, pubContacts] = await Promise.all([
        getStudent(studentId),
        getStudentTodayCheckins(appUser.studentRef),
        getPublicContacts(),
      ]);
      setStudent(s);
      setCheckins(c);
      setContacts(pubContacts);
    } catch (err) {
      console.error("student loadData error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("permission-denied") || msg.includes("insufficient")) {
        toast.error("권한 오류입니다. 로그아웃 후 다시 로그인해주세요.");
      } else {
        toast.error("데이터 로드 실패: " + msg);
      }
    } finally {
      setDataLoading(false);
    }
  }, [appUser, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeOpenSessions(setSessions);
    return unsub;
  }, [user]);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  if (loading || dataLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
        <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-bold text-sm text-gray-900">학생 포털</span>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-5">
          <StudentPageSkeleton />
        </main>
      </div>
    );
  }

  const mySessions = student
    ? sessions.filter((s) => sessionApplies(s, student))
    : [];

  const contactGroups: Record<string, Contact[]> = {};
  contacts.forEach((c) => {
    if (!contactGroups[c.구분]) contactGroups[c.구분] = [];
    contactGroups[c.구분].push(c);
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none text-gray-900">학생 포털</p>
              {student && (
                <p className="text-[11px] text-gray-400 leading-none mt-0.5">{student.이름}</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleLogout} className="text-gray-400 hover:text-gray-700">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <FadeStaggerContainer className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* 내 정보 */}
        {student && (
          <FadeStaggerItem><Card className="border-blue-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 px-5 py-4 text-white">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-blue-100">{student.학년}학년 {student.반}반 {student.번호}번</p>
                  <p className="text-2xl font-bold mt-0.5">{student.이름}</p>
                </div>
                {student.요양호여부 && (
                  <Badge className="bg-white/20 text-white border-white/30">요양호</Badge>
                )}
              </div>
            </div>
            <CardContent className="pt-4 pb-4 space-y-3 bg-white">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                  <Bus className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">호차</p>
                  <p className="font-bold text-sm text-gray-900">{student.호차}호차</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-2.5">
                  <Hotel className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">호실</p>
                  <p className="font-bold text-sm text-gray-900">{student.호실}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
                  <Plane className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-500">비행편</p>
                  <p className="font-bold text-sm text-gray-900">{student.비행편 || "-"}</p>
                </div>
              </div>
              {(student.건강요주의사항 || student.특이사항) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-2 text-xs">
                  <Heart className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-amber-800 space-y-0.5">
                    {student.건강요주의사항 && <p><span className="font-semibold">건강:</span> {student.건강요주의사항}</p>}
                    {student.특이사항 && <p><span className="font-semibold">특이:</span> {student.특이사항}</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card></FadeStaggerItem>
        )}

        {/* 바로가기 */}
        <FadeStaggerItem><div className="grid grid-cols-2 gap-3">
          <Link href="/schedule">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">여행 일정</p>
                <p className="text-xs text-gray-400">일차별 일정</p>
              </div>
            </div>
          </Link>
          <Link href="/contacts">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                <Phone className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">비상 연락처</p>
                <p className="text-xs text-gray-400">긴급 연락처</p>
              </div>
            </div>
          </Link>
          <Link href="/chat" className="col-span-2">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-amber-300 hover:shadow-md transition-all">
              <div className="w-9 h-9 bg-white/70 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">공지방</p>
                <p className="text-xs text-gray-500">담임·관리자 선생님 공지 수신</p>
              </div>
            </div>
          </Link>
        </div></FadeStaggerItem>

        {/* 진행 중 점호 */}
        <FadeStaggerItem><Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-900">
              <Clock className="w-4 h-4 text-amber-500" /> 진행 중인 점호
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mySessions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">현재 진행 중인 점호가 없습니다.</p>
            ) : (
              mySessions.map((s) => (
                <CheckinCard
                  key={s.id}
                  session={s}
                  student={student!}
                  uid={user.uid}
                  checkins={checkins}
                />
              ))
            )}
          </CardContent>
        </Card></FadeStaggerItem>

        {/* 오늘 점호 이력 */}
        <FadeStaggerItem><Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 오늘 점호 이력
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">오늘 점호 기록이 없습니다.</p>
            ) : (
              <div className="space-y-1.5">
                {checkins.map((c) => {
                  const method = c.method === "SELF_TAP" ? "자가 확인" : c.method === "TEACHER_TAP" ? "선생님 확인" : "QR 승차";
                  const ts = c.timestamp.toDate();
                  const timeStr = `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm py-2 px-2 rounded-lg bg-emerald-50/40 border border-emerald-100">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{method}</span>
                      </div>
                      <span className="text-gray-400 text-xs font-mono">{timeStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card></FadeStaggerItem>

        {/* 비상 연락처 */}
        {contacts.length > 0 && (
          <FadeStaggerItem><Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                <Phone className="w-4 h-4 text-emerald-500" /> 비상 연락처
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(contactGroups).map(([group, list]) => (
                <div key={group}>
                  <p className="text-xs text-gray-500 mb-2 font-medium">{group}</p>
                  <div className="space-y-1.5">
                    {list.map((c) => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className="text-sm text-gray-800">{c.이름}</span>
                        <a
                          href={`tel:${c.연락처.replace(/-/g, "")}`}
                          className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          {c.연락처}
                        </a>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-3 bg-gray-100" />
                </div>
              ))}
            </CardContent>
          </Card></FadeStaggerItem>
        )}

        {/* SOS */}
        <FadeStaggerItem><div className="pb-4 pt-2">
          <a href="tel:119">
            <Button className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold py-6 text-lg shadow-lg shadow-red-200">
              <AlertTriangle className="w-5 h-5 mr-2" />
              긴급 신고 (119)
            </Button>
          </a>
          <p className="text-center text-xs text-gray-400 mt-2">
            위급 상황 시 즉시 인솔 선생님께 연락하세요.
          </p>
        </div></FadeStaggerItem>
      </FadeStaggerContainer>
    </div>
  );
}
