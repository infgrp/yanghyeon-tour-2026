"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Search, AlertTriangle, LogOut, Loader2,
  Clock, Plus, ChevronRight, XCircle, GraduationCap, Bus, Hotel, Calendar, Phone,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/auth";
import {
  subscribeOpenSessions, subscribeSessionCheckins,
  createManualSession, extendSession, closeSession,
  getStudents,
} from "@/lib/firestore";
import type { CheckinSession, Checkin, Student } from "@/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeStaggerContainer, FadeStaggerItem } from "@/components/motion-presets";
import { SkeletonCard } from "@/components/ui/skeleton";
import { MiniDonut } from "@/components/mini-donut";
import { ActionCard, SectionHeader } from "@/components/action-card";


function timeLeft(session: CheckinSession): string {
  const diff = session.endAt.toDate().getTime() - Date.now();
  if (diff <= 0) return "마감";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SessionCard({ session, uid, totalStudents }: {
  session: CheckinSession;
  uid: string;
  totalStudents: number;
}) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [remaining, setRemaining] = useState(timeLeft(session));
  const [extending, setExtending] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const unsub = subscribeSessionCheckins(session.id, setCheckins);
    return unsub;
  }, [session.id]);

  useEffect(() => {
    // session 객체가 갱신되면 (예: +10분 연장) 즉시 새 endAt 으로 갱신
    setRemaining(timeLeft(session));
    const id = setInterval(() => setRemaining(timeLeft(session)), 1000);
    return () => clearInterval(id);
  }, [session]);

  const checkedCount = new Set(checkins.map((c) => c.studentRef)).size;
  const pct = totalStudents > 0 ? Math.round((checkedCount / totalStudents) * 100) : 0;

  async function handleExtend() {
    setExtending(true);
    try {
      await extendSession(session.id, 10);
      toast.success("10분 연장되었습니다.");
    } finally { setExtending(false); }
  }

  async function handleClose() {
    setClosing(true);
    try {
      await closeSession(session.id, uid);
      toast.success("점호가 종료되었습니다.");
    } finally { setClosing(false); }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{session.name}</p>
          <p className="text-xs text-gray-500">{session.type} · {session.scope}</p>
          <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 mt-1.5 text-[10px]">
            {remaining}
          </Badge>
        </div>
        <MiniDonut completed={checkedCount} total={totalStudents} size={56} stroke={6} />
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{checkedCount}/{totalStudents}명 완료</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${
            pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-blue-500" : pct >= 30 ? "bg-amber-500" : "bg-red-400"
          }`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={`/teacher/checkin?session=${session.id}`} className="flex-1">
          <Button size="sm" variant="outline" className="w-full border-gray-300 text-gray-600 hover:bg-gray-50">
            <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> 점호 현황
          </Button>
        </Link>
        <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50"
          onClick={handleExtend} disabled={extending}>
          {extending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+10분"}
        </Button>
        <Button size="sm" variant="outline" className="border-red-300 text-red-500 hover:bg-red-50"
          onClick={handleClose} disabled={closing}>
          {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function CreateSessionDialog({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"정시점호" | "승차점호">("정시점호");
  const [scopeType, setScopeType] = useState("전체");
  const [scopeVal, setScopeVal] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("점호명을 입력해주세요."); return; }
    let scope: string = "전체";
    if (scopeType === "학급") scope = `학급:${scopeVal}`;
    else if (scopeType === "호실") scope = `호실:${scopeVal}`;
    else if (scopeType === "호차") scope = `호차:${scopeVal}`;
    setBusy(true);
    try {
      await createManualSession({
        type, scope: scope as Parameters<typeof createManualSession>[0]["scope"],
        name: name.trim(), durationMinutes: duration, openedBy: uid,
      });
      toast.success("점호 세션이 시작되었습니다.");
      setOpen(false); setName(""); setScopeVal(""); setScopeType("전체");
    } catch { toast.error("세션 생성 실패."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-4 h-4" /> 점호 시작
      </DialogTrigger>
      <DialogContent className="bg-white border-gray-200 text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900">수동 점호 시작</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-gray-700">점호명</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 2일차 저녁 점호"
              className="border-gray-300 text-gray-900 bg-white" required />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">유형</Label>
            <div className="flex gap-2">
              {(["정시점호", "승차점호"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">대상</Label>
            <div className="flex gap-1.5 flex-wrap">
              {(["전체", "학급", "호실", "호차"] as const).map((s) => (
                <button key={s} type="button" onClick={() => { setScopeType(s); setScopeVal(""); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    scopeType === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            {scopeType !== "전체" && (
              <Input value={scopeVal} onChange={(e) => setScopeVal(e.target.value)}
                placeholder={
                  scopeType === "학급" ? "반 번호 (예: 1)" :
                  scopeType === "호실" ? "호실 (예: 201)" : "호차 번호 (예: 1)"
                }
                className="border-gray-300 text-gray-900 bg-white mt-1" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">진행 시간</Label>
            <div className="flex gap-2">
              {[10, 20, 30, 60].map((m) => (
                <button key={m} type="button" onClick={() => setDuration(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    duration === m
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}>
                  {m}분
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}점호 시작
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeacherPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<CheckinSession[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") {
      router.replace(role === "student" ? "/student" : "/");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeOpenSessions(setSessions);
    return unsub;
  }, [user]);

  useEffect(() => {
    getStudents().then((s: Student[]) => setTotalStudents(s.length));
  }, []);

  // user가 null이면 (로그아웃 직후 redirect 대기 중) render 가드
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
        <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-bold text-sm text-gray-900">교사 포털</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          <SkeletonCard />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonCard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">교사 포털</p>
              {appUser?.이름 && (
                <p className="text-[11px] text-gray-400 leading-none mt-0.5">{appUser.이름} 선생님</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreateSessionDialog uid={user.uid} />
            <Button size="sm" variant="ghost"
              onClick={async () => { await signOut(); router.replace("/login"); }}
              className="text-gray-400 hover:text-gray-700">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <FadeStaggerContainer className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* 내 반 점호 현황 — 진행 중인 세션이 있고 담임반이 설정된 경우에만 표시 */}
        {appUser?.담임반 && sessions.length > 0 && (() => {
          const current = sessions[0];
          const isBus = current.type === "승차점호";
          return (
            <FadeStaggerItem><Link href={isBus ? "/teacher/boarding" : `/teacher/checkin?session=${current.id}`}>
              <div className={`${isBus ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"} rounded-2xl p-4 flex items-center justify-between shadow-md transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    {isBus
                      ? <Bus className="w-5 h-5 text-white" />
                      : <ClipboardList className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{current.name}</p>
                    <p className="text-xs text-white/70">
                      {appUser.담임학년 ? `${appUser.담임학년}학년 ` : ""}{appUser.담임반}반 · 실시간 모니터링
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/80" />
              </div>
            </Link></FadeStaggerItem>
          );
        })()}

        {/* 진행 중인 점호 — 가장 prominent (있을 때만 표시) */}
        {sessions.length > 0 && (
          <FadeStaggerItem>
            <SectionHeader title="진행 중인 점호" subtitle={`${sessions.length}개 활성`} />
            <div className="space-y-2">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} uid={user.uid} totalStudents={totalStudents} />
              ))}
            </div>
          </FadeStaggerItem>
        )}

        {/* 핵심 액션 — 4개 grid */}
        <FadeStaggerItem>
          <SectionHeader title="자주 쓰는 액션" />
          <div className="grid grid-cols-2 gap-2">
            <ActionCard href="/teacher/search" tone="blue" icon={Search}
              label="학생 검색" desc="이름·번호 조회" />
            <ActionCard href="/teacher/incident" tone="red" icon={AlertTriangle}
              label="사건사고 등록" desc="인시던트 기록" />
            <ActionCard href="/teacher/boarding" tone="indigo" icon={Bus}
              label="승차 현황" desc="호차·반별 실시간" />
            <ActionCard href="/chat" tone="amber" icon={MessageCircle}
              label="채팅" desc="공지 송수신" />
          </div>
        </FadeStaggerItem>

        {/* 보조 메뉴 */}
        <FadeStaggerItem>
          <SectionHeader title="조회" />
          <div className="grid grid-cols-3 gap-2">
            <ActionCard href="/teacher/rooms" tone="indigo" icon={Hotel} label="숙소 배정" />
            <ActionCard href="/schedule" tone="blue" icon={Calendar} label="여행 일정" />
            <ActionCard href="/contacts" tone="green" icon={Phone} label="비상 연락처" />
          </div>
        </FadeStaggerItem>

        {/* 진행 중 점호가 없을 때 안내 */}
        {sessions.length === 0 && (
          <FadeStaggerItem>
            <Card className="bg-white border-gray-200 border-dashed shadow-sm">
              <CardContent className="py-6 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">진행 중인 점호가 없습니다.</p>
                <p className="text-xs mt-1">상단 &quot;점호 시작&quot; 버튼으로 수동 점호를 시작하세요.</p>
              </CardContent>
            </Card>
          </FadeStaggerItem>
        )}
      </FadeStaggerContainer>
    </div>
  );
}
