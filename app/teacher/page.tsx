"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Search, AlertTriangle, LogOut, Loader2,
  Users, Clock, Plus, ChevronRight, XCircle,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function timeLeft(session: CheckinSession): string {
  const diff = session.endAt.toDate().getTime() - Date.now();
  if (diff <= 0) return "마감";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── 세션 카드 ────────────────────────────────────────────────────
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
    } finally {
      setExtending(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      await closeSession(session.id, uid);
      toast.success("점호가 종료되었습니다.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{session.name}</p>
          <p className="text-xs text-slate-400">{session.type} · {session.scope}</p>
        </div>
        <Badge variant="outline" className="border-amber-500 text-amber-400">
          {remaining}
        </Badge>
      </div>

      {/* 진행률 */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{checkedCount}명 완료</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={`/teacher/checkin?session=${session.id}`} className="flex-1">
          <Button size="sm" variant="outline" className="w-full border-slate-600 text-slate-300">
            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
            점호 현황
          </Button>
        </Link>
        <Button
          size="sm" variant="outline"
          className="border-blue-700 text-blue-400"
          onClick={handleExtend} disabled={extending}
        >
          {extending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+10분"}
        </Button>
        <Button
          size="sm" variant="outline"
          className="border-red-800 text-red-400"
          onClick={handleClose} disabled={closing}
        >
          {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ── 세션 생성 다이얼로그 ─────────────────────────────────────────
function CreateSessionDialog({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"정시점호" | "승차점호">("정시점호");
  const [scopeType, setScopeType] = useState("전체");
  const [scopeVal, setScopeVal] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
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
        type,
        scope: scope as Parameters<typeof createManualSession>[0]["scope"],
        name: name.trim(),
        durationMinutes: Number(duration),
        openedBy: uid,
      });
      toast.success("점호 세션이 시작되었습니다.");
      setOpen(false);
      setName("");
    } catch {
      toast.error("세션 생성 실패.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-4 h-4" /> 점호 시작
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle>수동 점호 시작</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-slate-300">점호명</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 2일차 저녁 점호"
              className="bg-slate-800 border-slate-600 text-slate-100" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">유형</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="정시점호">정시점호</SelectItem>
                  <SelectItem value="승차점호">승차점호</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">대상</Label>
              <Select value={scopeType} onValueChange={(v) => { if (v !== null) setScopeType(v); }}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="전체">전체</SelectItem>
                  <SelectItem value="학급">학급(반)</SelectItem>
                  <SelectItem value="호실">호실</SelectItem>
                  <SelectItem value="호차">호차</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {scopeType !== "전체" && (
            <div className="space-y-2">
              <Label className="text-slate-300">
                {scopeType === "학급" ? "반 번호" : scopeType === "호실" ? "호실 번호" : "호차 번호"}
              </Label>
              <Input value={scopeVal} onChange={(e) => setScopeVal(e.target.value)}
                className="bg-slate-800 border-slate-600 text-slate-100" required />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-slate-300">진행 시간 (분)</Label>
            <Input type="number" min={5} max={120} value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="bg-slate-800 border-slate-600 text-slate-100" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}점호 시작
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
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
      return;
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

  async function handleLogout() {
    await signOut();
    router.replace("/login");
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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold">교사 포털</p>
            {appUser?.이름 && (
              <p className="text-xs text-slate-400">{appUser.이름} 선생님</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && <CreateSessionDialog uid={user.uid} />}
            <Button size="sm" variant="ghost" onClick={handleLogout} className="text-slate-400">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* 빠른 메뉴 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/teacher/search">
            <Card className="bg-slate-900 border-slate-700 hover:border-blue-700 transition-colors cursor-pointer">
              <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2">
                <Search className="w-7 h-7 text-blue-400" />
                <p className="font-medium text-sm">학생 검색</p>
                <p className="text-xs text-slate-500">이름·번호로 조회</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/teacher/incident">
            <Card className="bg-slate-900 border-slate-700 hover:border-red-700 transition-colors cursor-pointer">
              <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2">
                <AlertTriangle className="w-7 h-7 text-red-400" />
                <p className="font-medium text-sm">사건사고 등록</p>
                <p className="text-xs text-slate-500">인시던트 기록</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 진행 중 점호 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> 진행 중인 점호
              </CardTitle>
              <Badge variant="outline" className="border-slate-600 text-slate-400">
                {sessions.length}개
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">진행 중인 점호가 없습니다.</p>
                <p className="text-xs mt-1">상단 "점호 시작" 버튼으로 수동 점호를 시작하세요.</p>
              </div>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  uid={user!.uid}
                  totalStudents={totalStudents}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* 전체 점호 현황 링크 */}
        {sessions.length > 0 && (
          <Link href={`/teacher/checkin?session=${sessions[0].id}`}>
            <Card className="bg-slate-800/60 border-slate-700 hover:border-slate-500 transition-colors cursor-pointer">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">전체 점호 현황 보기</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </CardContent>
            </Card>
          </Link>
        )}
      </main>
    </div>
  );
}
