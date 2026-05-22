"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User, Bus, Hotel, Plane, CheckCircle2, Clock, Phone,
  AlertTriangle, LogOut, QrCode, Loader2, Calendar, MessageCircle, Heart,
  PackageSearch,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/auth";
import { getStudent, subscribeOpenSessions, getStudentTodayCheckins, createCheckin } from "@/lib/firestore";
import type { Student, CheckinSession, Checkin } from "@/types";
import { FadeStaggerContainer, FadeStaggerItem } from "@/components/motion-presets";
import { StudentPageSkeleton } from "@/components/ui/skeleton";
import { ActionCard, SectionHeader } from "@/components/action-card";

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
        <Link href="/student/qr"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
          <QrCode className="w-4 h-4" />
          QR 스캔으로 승차 확인
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
    // 각 호출이 독립적으로 실패해도 다른 데이터는 표시되도록
    // Promise.all 대신 allSettled 사용 + 개별 catch.
    const [sRes, cRes] = await Promise.allSettled([
      getStudent(studentId),
      getStudentTodayCheckins(appUser.studentRef),
    ]);

    if (sRes.status === "fulfilled") {
      setStudent(sRes.value);
    } else {
      console.error("student load failed:", sRes.reason);
    }

    if (cRes.status === "fulfilled") {
      setCheckins(cRes.value);
    } else {
      console.error("checkins load failed:", cRes.reason);
      // 점호 이력은 권한 거부 시 빈 배열로 두고 silent fail
      setCheckins([]);
    }

    // 전체 실패 (예: 학생 doc 자체 없음) 시에만 에러 toast
    if (sRes.status === "rejected") {
      const msg = sRes.reason instanceof Error ? sRes.reason.message : String(sRes.reason);
      if (msg.includes("permission-denied") || msg.includes("insufficient")) {
        toast.error("권한 오류입니다. 로그아웃 후 다시 로그인해주세요.");
      } else {
        toast.error("학생 정보 로드 실패: " + msg);
      }
    }

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
        {/* 1) 진행 중 점호 — 가장 위 (있을 때만 prominent) */}
        {mySessions.length > 0 && (
          <FadeStaggerItem>
            <SectionHeader title="지금 점호 중" subtitle={`${mySessions.length}건 진행 중`} />
            <div className="space-y-2">
              {mySessions.map((s) => (
                <CheckinCard key={s.id} session={s} student={student!} uid={user.uid} checkins={checkins} />
              ))}
            </div>
          </FadeStaggerItem>
        )}

        {/* 2) 내 정보 */}
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

        {/* 3) 바로가기 — 3개 핵심 액션 */}
        <FadeStaggerItem>
          <SectionHeader title="바로가기" />
          <div className="grid grid-cols-2 gap-2">
            <ActionCard href="/chat" tone="amber" icon={MessageCircle} label="공지방" desc="공지 수신" />
            <ActionCard href="/schedule" tone="blue" icon={Calendar} label="여행 일정" desc="일차별" />
            <ActionCard href="/contacts" tone="green" icon={Phone} label="비상 연락처" desc="긴급" />
            <ActionCard href="/lost-items" tone="purple" icon={PackageSearch} label="분실물" desc="분실·습득 신고" />
          </div>
        </FadeStaggerItem>

        {/* 4) 진행 점호 없을 때 안내 */}
        {mySessions.length === 0 && (
          <FadeStaggerItem>
            <Card className="bg-white border-gray-200 border-dashed shadow-sm">
              <CardContent className="py-6 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">현재 진행 중인 점호가 없습니다.</p>
                <p className="text-xs mt-1">점호 시간이 되면 자동으로 알림이 표시됩니다.</p>
              </CardContent>
            </Card>
          </FadeStaggerItem>
        )}

        {/* 5) 오늘 점호 이력 — 있을 때만 */}
        {checkins.length > 0 && (
          <FadeStaggerItem>
            <SectionHeader title="오늘 점호" subtitle={`${checkins.length}건 완료`} />
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
              {checkins.map((c) => {
                const method = c.method === "SELF_TAP" ? "자가 확인" : c.method === "TEACHER_TAP" ? "선생님 확인" : "QR 승차";
                const ts = c.timestamp.toDate();
                const timeStr = `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`;
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm py-2.5 px-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{method}</span>
                    </div>
                    <span className="text-gray-400 text-xs font-mono">{timeStr}</span>
                  </div>
                );
              })}
            </div>
          </FadeStaggerItem>
        )}

        {/* 6) SOS — 항상 하단 */}
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
