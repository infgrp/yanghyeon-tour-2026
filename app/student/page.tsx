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
  AlertTriangle, LogOut, QrCode, Loader2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/auth";
import { getStudent, subscribeOpenSessions, getStudentTodayCheckins, createCheckin, getPublicContacts } from "@/lib/firestore";
import type { Student, CheckinSession, Checkin, Contact } from "@/types";

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
    if (isBus) return; // 승차점호는 QR 스캔으로만
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
    <div className="border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{session.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {session.type} · {session.scope}
          </p>
        </div>
        <Badge
          variant="outline"
          className={alreadyChecked
            ? "border-green-500 text-green-400"
            : "border-amber-500 text-amber-400"}
        >
          {alreadyChecked ? "완료" : remaining}
        </Badge>
      </div>

      {alreadyChecked ? (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>점호 완료되었습니다.</span>
        </div>
      ) : isBus ? (
        <Link href="/student/qr">
          <Button className="w-full" variant="outline">
            <QrCode className="w-4 h-4 mr-2" />
            QR 스캔으로 승차 확인
          </Button>
        </Link>
      ) : (
        <Button className="w-full" onClick={handleSelfTap} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
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
    const studentId = appUser.studentRef.split("/").pop()!;
    const [s, c, pubContacts] = await Promise.all([
      getStudent(studentId),
      getStudentTodayCheckins(appUser.studentRef),
      getPublicContacts(),
    ]);
    setStudent(s);
    setCheckins(c);
    setContacts(pubContacts);
    setDataLoading(false);
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

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            <span className="font-bold">학생 포털</span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleLogout} className="text-slate-400">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* 내 정보 */}
        {student && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" /> 내 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{student.이름}</span>
                <Badge className="bg-blue-800 text-blue-100">
                  {student.학년}학년 {student.반}반 {student.번호}번
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-800 rounded-lg p-2">
                  <Bus className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">호차</p>
                  <p className="font-bold">{student.호차}호차</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <Hotel className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">호실</p>
                  <p className="font-bold">{student.호실}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <Plane className="w-4 h-4 text-green-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">비행편</p>
                  <p className="font-bold text-sm">{student.비행편 || "-"}</p>
                </div>
              </div>
              {(student.건강요주의사항 || student.특이사항) && (
                <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-2 text-xs text-amber-300">
                  {student.건강요주의사항 && <p>건강: {student.건강요주의사항}</p>}
                  {student.특이사항 && <p>특이: {student.특이사항}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 진행 중 점호 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> 진행 중인 점호
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mySessions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-3">현재 진행 중인 점호가 없습니다.</p>
            ) : (
              mySessions.map((s) => (
                <CheckinCard
                  key={s.id}
                  session={s}
                  student={student!}
                  uid={user!.uid}
                  checkins={checkins}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* 오늘 점호 이력 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> 오늘 점호 이력
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-3">오늘 점호 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {checkins.map((c) => {
                  const method = c.method === "SELF_TAP" ? "자가 확인" : c.method === "TEACHER_TAP" ? "선생님 확인" : "QR 승차";
                  const ts = c.timestamp.toDate();
                  const timeStr = `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        <span>{method}</span>
                      </div>
                      <span className="text-slate-400 text-xs">{timeStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 비상 연락처 */}
        {contacts.length > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-400" /> 비상 연락처
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(contactGroups).map(([group, list]) => (
                <div key={group}>
                  <p className="text-xs text-slate-400 mb-2">{group}</p>
                  <div className="space-y-1.5">
                    {list.map((c) => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className="text-sm">{c.이름}</span>
                        <a
                          href={`tel:${c.연락처.replace(/-/g, "")}`}
                          className="flex items-center gap-1.5 bg-green-900/40 text-green-300 text-xs px-3 py-1.5 rounded-lg"
                        >
                          <Phone className="w-3 h-3" />
                          {c.연락처}
                        </a>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-3 bg-slate-800" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* SOS */}
        <div className="pb-4">
          <a href="tel:119">
            <Button className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-6 text-lg">
              <AlertTriangle className="w-5 h-5 mr-2" />
              긴급 신고 (119)
            </Button>
          </a>
          <p className="text-center text-xs text-slate-500 mt-2">
            위급 상황 시 즉시 인솔 선생님께 연락하세요.
          </p>
        </div>
      </main>
    </div>
  );
}
