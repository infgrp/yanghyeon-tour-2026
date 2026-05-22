"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users, Upload, Settings, LogOut, Loader2, Shield, QrCode,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Key,
  ToggleLeft, ToggleRight, Plus, X, Search, GraduationCap, Timer, Bus, Calendar, Phone,
  MessageCircle, Megaphone, Send, Mail,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { signOut, sendStudentPasswordReset } from "@/lib/auth";
import { notifyCheckinSession } from "@/lib/notify";
import {
  getStudents, getIncidents, subscribeOpenSessions,
  getSettings, updateSettings, resetStudentUid,
  getBuses, createManualSession, closeSession, extendSession, getTeachers,
  broadcastAnnouncement,
} from "@/lib/firestore";
import { useAutoCheckin } from "@/lib/use-auto-checkin";
import { FadeStaggerContainer, FadeStaggerItem } from "@/components/motion-presets";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EnrollmentCharts, ClassDistribution } from "@/components/dashboard-charts";
import { ActionCard, SectionHeader } from "@/components/action-card";
import { printBusQRs } from "@/lib/qr";
import type {
  Student, Incident, CheckinSession, GlobalSettings, SessionScope, AppUser,
} from "@/types";

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, bg, icon: Icon }: {
  label: string; value: number; sub: string;
  color: string; bg: string; icon: React.ElementType;
}) {
  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Create Session Dialog ────────────────────────────────────────
function CreateSessionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"정시점호" | "승차점호">("정시점호");
  const [scopeType, setScopeType] = useState<"전체" | "학급" | "호실" | "호차">("전체");
  const [scopeValue, setScopeValue] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  async function handleCreate() {
    setLoading(true);
    try {
      let scope: SessionScope = "전체";
      if (scopeType !== "전체" && scopeValue.trim()) {
        scope = `${scopeType}:${scopeValue.trim()}` as SessionScope;
      }
      const sessionName = name.trim() || `${type} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
      const sessionId = await createManualSession({
        type,
        scope,
        name: sessionName,
        durationMinutes: duration,
        openedBy: user!.uid,
      });
      notifyCheckinSession({ sessionId, type, name: sessionName, scope });
      toast.success("점호 세션이 생성되었습니다.");
      setOpen(false);
      setName(""); setScopeValue(""); setScopeType("전체");
      onCreated();
    } catch {
      toast.error("세션 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-3.5 h-3.5" /> 새 세션
      </DialogTrigger>
      <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-gray-900">점호 세션 만들기</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">점호 유형</Label>
            <div className="flex gap-2">
              {(["정시점호", "승차점호"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
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
            <Label className="text-gray-700 text-sm">세션 이름 (선택)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 2일차 저녁 점호"
              className="border-gray-300 text-gray-900 bg-white" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">범위</Label>
            <div className="flex gap-1.5 flex-wrap">
              {(["전체", "학급", "호실", "호차"] as const).map((s) => (
                <button key={s} onClick={() => { setScopeType(s); setScopeValue(""); }}
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
              <Input value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}
                placeholder={
                  scopeType === "학급" ? "반 번호 (예: 1)" :
                  scopeType === "호실" ? "호실 (예: 201)" : "호차 번호 (예: 1)"
                }
                className="border-gray-300 text-gray-900 bg-white mt-1" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">운영 시간</Label>
            <div className="flex gap-2">
              {[10, 20, 30, 60].map((m) => (
                <button key={m} onClick={() => setDuration(m)}
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

          <Button className="w-full" onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            세션 시작
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Session Card ─────────────────────────────────────────────────
function SessionCard({ session, onClose, onExtend }: {
  session: CheckinSession;
  onClose: (id: string) => void;
  onExtend: (id: string) => void;
}) {
  const minutesLeft = Math.max(0,
    Math.round((session.endAt.toDate().getTime() - Date.now()) / 60000)
  );
  const isActive = minutesLeft > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{session.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1.5">{session.type}</Badge>
            <span className="text-xs text-gray-400">{session.scope}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          <span className="text-xs font-medium text-gray-600">
            {isActive ? `${minutesLeft}분 남음` : "만료"}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline"
          className="flex-1 h-8 border-blue-300 text-blue-600 hover:bg-blue-50 text-xs"
          onClick={() => onExtend(session.id)}>
          <Timer className="w-3 h-3 mr-1" /> +10분
        </Button>
        <Button size="sm" variant="outline"
          className="flex-1 h-8 border-red-300 text-red-500 hover:bg-red-50 text-xs"
          onClick={() => onClose(session.id)}>
          <X className="w-3 h-3 mr-1" /> 종료
        </Button>
      </div>
    </div>
  );
}

// ── Broadcast Announcement Dialog ────────────────────────────────
function BroadcastDialog({ students }: { students: Student[] }) {
  const { user, appUser, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [scope, setScope] = useState<"all" | "byGrade" | "selected">("all");
  const [grade, setGrade] = useState<number | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [includeStaff, setIncludeStaff] = useState(true);
  const [sending, setSending] = useState(false);

  // 학생 데이터 기반 학년·반 그룹
  const grades = Array.from(new Set(students.map((s) => s.학년))).sort((a, b) => a - b);
  const classesByGrade = new Map<number, number[]>();
  students.forEach((s) => {
    const list = classesByGrade.get(s.학년) ?? [];
    if (!list.includes(s.반)) list.push(s.반);
    classesByGrade.set(s.학년, list);
  });
  classesByGrade.forEach((list) => list.sort((a, b) => a - b));

  const allTargets = (() => {
    const out: { 학년: number; 반: number }[] = [];
    if (scope === "all") {
      grades.forEach((g) => (classesByGrade.get(g) ?? []).forEach((c) => out.push({ 학년: g, 반: c })));
    } else if (scope === "byGrade" && grade != null) {
      (classesByGrade.get(grade) ?? []).forEach((c) => out.push({ 학년: grade, 반: c }));
    } else if (scope === "selected") {
      selectedClasses.forEach((key) => {
        const [g, c] = key.split("-").map(Number);
        out.push({ 학년: g, 반: c });
      });
    }
    return out;
  })();

  function toggleClass(g: number, c: number) {
    const key = `${g}-${c}`;
    const next = new Set(selectedClasses);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedClasses(next);
  }

  async function handleSend() {
    if (!user || !appUser || !role || allTargets.length === 0 || !text.trim()) return;
    setSending(true);
    try {
      const res = await broadcastAnnouncement({
        targets: allTargets,
        text: text.trim(),
        sender: {
          uid: user.uid,
          name: appUser.이름 ?? "관리자",
          role,
        },
        alsoSendToAdminTeachers: includeStaff,
      });
      if (res.failed.length === 0) {
        toast.success(`${res.ok}개 반에 공지 발송됨`);
      } else {
        toast.warning(`발송 ${res.ok}건 / 실패 ${res.failed.length}건`);
      }
      setOpen(false);
      setText("");
      setSelectedClasses(new Set());
    } catch {
      toast.error("발송 실패");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button type="button" className="block w-full text-left" />
      }>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-sm leading-tight">공지 일괄 발송</p>
              <p className="text-[11px] text-white/80 mt-0.5">여러 반에 한 번에</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600" />
            공지 일괄 발송
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">대상</Label>
            <div className="flex gap-1.5 flex-wrap">
              {([
                ["all", "전체 반"],
                ["byGrade", "특정 학년"],
                ["selected", "반 직접 선택"],
              ] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setScope(val)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    scope === val
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {scope === "byGrade" && (
              <div className="flex gap-1.5 mt-2">
                {grades.map((g) => (
                  <button key={g} type="button" onClick={() => setGrade(g)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      grade === g
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}>
                    {g}학년
                  </button>
                ))}
              </div>
            )}

            {scope === "selected" && (
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1">
                {grades.map((g) => (
                  <div key={g}>
                    <p className="text-[11px] text-gray-400 mb-1">{g}학년</p>
                    <div className="flex flex-wrap gap-1">
                      {(classesByGrade.get(g) ?? []).map((c) => {
                        const key = `${g}-${c}`;
                        const on = selectedClasses.has(key);
                        return (
                          <button key={key} type="button" onClick={() => toggleClass(g, c)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              on
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                            }`}>
                            {c}반
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-500 mt-1">
              발송 대상: <span className="font-semibold text-gray-700">{allTargets.length}개 반</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">메시지</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="모든 학생에게 전달할 공지 내용을 입력하세요"
              maxLength={500}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-[10px] text-gray-400 text-right">{text.length}/500</p>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={includeStaff}
              onChange={(e) => setIncludeStaff(e.target.checked)}
              className="rounded border-gray-300" />
            교직원 방에도 발송 사본 남기기
          </label>

          <Button className="w-full" onClick={handleSend}
            disabled={sending || !text.trim() || allTargets.length === 0}>
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <Send className="w-4 h-4 mr-2" />}
            {allTargets.length}개 반에 발송
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────
function DashboardTab({ students, incidents, sessions, onPrintQR, printingQR }: {
  students: Student[]; incidents: Incident[]; sessions: CheckinSession[];
  onPrintQR: () => void; printingQR: boolean;
}) {
  const registered = students.filter((s) => s.uid).length;
  const openIncidents = incidents.filter((i) => !i.종결여부).length;

  const activeSession = sessions[0];

  return (
    <FadeStaggerContainer className="space-y-5">
      {/* 1) 진행 중 점호 — 가장 prominent */}
      {activeSession && (
        <FadeStaggerItem>
          <Link href={`/teacher/checkin?session=${activeSession.id}`}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{activeSession.name}</p>
                    <p className="text-xs text-white/80">
                      {activeSession.type} · {activeSession.scope}
                      {sessions.length > 1 && ` · +${sessions.length - 1}건 더`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/80" />
              </div>
            </div>
          </Link>
        </FadeStaggerItem>
      )}

      {/* 2) 통계 4종 */}
      <FadeStaggerItem><div className="grid grid-cols-2 gap-2">
        <StatCard label="전체 학생" value={students.length} sub={`가입 ${registered}명`}
          color="text-blue-600" bg="bg-blue-50" icon={Users} />
        <StatCard label="진행 점호" value={sessions.length} sub="활성 세션"
          color="text-amber-500" bg="bg-amber-50" icon={Clock} />
        <StatCard label="미처리 사건" value={openIncidents} sub="건"
          color={openIncidents > 0 ? "text-red-500" : "text-gray-400"}
          bg={openIncidents > 0 ? "bg-red-50" : "bg-gray-50"} icon={AlertTriangle} />
        <StatCard label="누적 사건" value={incidents.length} sub="전체"
          color="text-gray-500" bg="bg-gray-100" icon={CheckCircle2} />
      </div></FadeStaggerItem>

      {/* 3) 핵심 운영 액션 (primary) */}
      <FadeStaggerItem>
        <SectionHeader title="운영" subtitle="자주 쓰는 액션" />
        <div className="grid grid-cols-1 gap-2.5">
          <BroadcastDialog students={students} />
          <ActionCard
            href="/teacher/incident"
            variant="primary"
            tone={openIncidents > 0 ? "red" : "slate"}
            icon={AlertTriangle}
            label="사건사고 관리"
            desc={openIncidents > 0 ? `미처리 ${openIncidents}건` : "모두 처리됨"}
            badge={openIncidents > 0 ? String(openIncidents) : undefined}
          />
          <ActionCard
            href="/teacher/boarding"
            variant="primary"
            tone="blue"
            icon={Bus}
            label="승차 현황 모니터링"
            desc="전체 반 실시간"
          />
        </div>
      </FadeStaggerItem>

      {/* 4) 차트 */}
      <FadeStaggerItem>
        <SectionHeader title="현황" subtitle="가입·학년별 통계" />
        <EnrollmentCharts students={students} />
      </FadeStaggerItem>
      <FadeStaggerItem>
        <ClassDistribution students={students} />
      </FadeStaggerItem>

      {/* 5) 보조 메뉴 (secondary 그리드) */}
      <FadeStaggerItem>
        <SectionHeader title="조회·소통" />
        <div className="grid grid-cols-4 gap-2">
          <ActionCard href="/chat" tone="amber" icon={MessageCircle} label="채팅" />
          <ActionCard href="/schedule" tone="blue" icon={Calendar} label="일정" />
          <ActionCard href="/contacts" tone="green" icon={Phone} label="연락처" />
          <ActionCard href="/teacher/checkin?session=latest" tone="indigo" icon={CheckCircle2} label="점호 뷰" />
        </div>
      </FadeStaggerItem>

      {/* 6) 데이터 관리 */}
      <FadeStaggerItem>
        <SectionHeader title="데이터 관리" subtitle="업로드·인쇄" />
        <div className="grid grid-cols-2 gap-2">
          <ActionCard href="/admin/upload" tone="blue" icon={Upload} label="Excel 업로드" desc="학생·호실·일정" />
          <ActionCard onClick={onPrintQR} disabled={printingQR} tone="green" icon={QrCode}
            label={printingQR ? "준비 중..." : "버스 QR 인쇄"} desc="호차별 출력" />
        </div>
      </FadeStaggerItem>
    </FadeStaggerContainer>
  );
}

// ── Students Tab ──────────────────────────────────────────────────
function StudentsTab({ students }: { students: Student[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "registered" | "unregistered">("all");

  const filtered = students.filter((s) => {
    const matchSearch = !search ||
      s.이름.includes(search) ||
      String(s.반).includes(search) ||
      String(s.학년).includes(search);
    const matchFilter =
      filter === "all" ||
      (filter === "registered" && !!s.uid) ||
      (filter === "unregistered" && !s.uid);
    return matchSearch && matchFilter;
  }).sort((a, b) => a.학년 - b.학년 || a.반 - b.반 || a.번호 - b.번호);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 학년, 반 검색"
          className="pl-9 border-gray-300 bg-white text-gray-900" />
      </div>
      <div className="flex items-center gap-2">
        {([["all", "전체"], ["registered", "가입"], ["unregistered", "미가입"]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === val
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length}명</span>
      </div>
      <div className="space-y-1.5">
        {filtered.map((s) => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="font-semibold text-sm text-gray-900">{s.이름}</span>
              <span className="text-xs text-gray-500 ml-2">{s.학년}학년 {s.반}반 {s.번호}번</span>
              <div className="text-xs text-gray-400 mt-0.5">{s.호실}호 · {s.호차}호차</div>
            </div>
            <Badge className={s.uid
              ? "bg-green-100 text-green-700 border-green-200 text-xs"
              : "bg-gray-100 text-gray-500 border-gray-200 text-xs"
            }>
              {s.uid ? "가입" : "미가입"}
            </Badge>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">검색 결과가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// ── Teachers Tab ──────────────────────────────────────────────────
function TeachersTab() {
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    getTeachers().then((t) => {
      setTeachers(t.sort((a, b) =>
        ((a.담임학년 ?? 99) - (b.담임학년 ?? 99)) || ((a.담임반 ?? 99) - (b.담임반 ?? 99))
      ));
      setLoading(false);
    });
  }, []);

  async function handlePasswordReset(t: AppUser) {
    if (!t.email) { toast.error("이메일 정보가 없습니다."); return; }
    setResetting(t.uid);
    try {
      await sendStudentPasswordReset(t.email);
      toast.success(`${t.이름 ?? t.email}에게 비밀번호 재설정 이메일을 발송했습니다.`);
    } catch {
      toast.error("이메일 발송 실패. 이메일 주소를 확인해주세요.");
    } finally {
      setResetting(null);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">가입된 교사 계정 {teachers.length}명</p>
      {teachers.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-10">가입된 교사가 없습니다.</p>
      )}
      {teachers.map((t) => (
        <div key={t.uid} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900">{t.이름 || "(이름 없음)"}</p>
            <p className="text-xs text-gray-500">
              {t.담임학년 && t.담임반
                ? `${t.담임학년}학년 ${t.담임반}반 담임`
                : "담임 미지정"}
            </p>
            {t.email && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{t.email}</p>
            )}
          </div>
          <Button
            size="sm" variant="outline"
            className="shrink-0 h-8 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
            onClick={() => handlePasswordReset(t)}
            disabled={resetting === t.uid}
          >
            {resetting === t.uid
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><Mail className="w-3 h-3 mr-1" />비번 재설정</>}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────
function SessionsTab({ sessions }: { sessions: CheckinSession[] }) {
  const { user } = useAuth();

  async function handleClose(id: string) {
    try {
      await closeSession(id, user!.uid);
      toast.success("세션이 종료되었습니다.");
    } catch {
      toast.error("종료 실패");
    }
  }

  async function handleExtend(id: string) {
    try {
      await extendSession(id, 10);
      toast.success("10분 연장되었습니다.");
    } catch {
      toast.error("연장 실패");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">활성 세션 {sessions.length}개</p>
        <CreateSessionDialog onCreated={() => {}} />
      </div>
      {sessions.length === 0 ? (
        <div className="text-center py-14">
          <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">진행 중인 점호 세션이 없습니다.</p>
          <p className="text-gray-400 text-xs mt-1">새 세션을 만들어 점호를 시작하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onClose={handleClose} onExtend={handleExtend} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────
function SettingsTab({ students }: { students: Student[] }) {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetSearch, setResetSearch] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      if (s) setCode(s.teacherSignupCode);
    });
  }, []);

  async function handleSave() {
    if (!code.trim()) { toast.error("코드를 입력해주세요."); return; }
    setSaving(true);
    try {
      await updateSettings({ teacherSignupCode: code.trim() });
      toast.success("저장되었습니다.");
    } finally { setSaving(false); }
  }

  async function toggleLock() {
    if (!settings) return;
    const next = !settings.enrollmentLocked;
    await updateSettings({ enrollmentLocked: next });
    setSettings({ ...settings, enrollmentLocked: next });
    toast.success(next ? "학생 가입이 잠겼습니다." : "학생 가입이 열렸습니다.");
  }

  async function toggleQR() {
    if (!settings) return;
    const next = !settings.qrTokensActive;
    await updateSettings({ qrTokensActive: next });
    setSettings({ ...settings, qrTokensActive: next });
    toast.success(next ? "QR 승차점호가 활성화되었습니다." : "QR 승차점호가 비활성화되었습니다.");
  }

  async function toggleAutoCheckin() {
    if (!settings) return;
    const next = !settings.autoCheckinEnabled;
    await updateSettings({ autoCheckinEnabled: next });
    setSettings({ ...settings, autoCheckinEnabled: next });
    toast.success(next
      ? "자동 점호가 활성화되었습니다. (관리자 페이지가 열려있을 때 동작)"
      : "자동 점호가 비활성화되었습니다.");
  }

  const filteredStudents = students.filter(
    (s) => s.uid && (!resetSearch || s.이름.includes(resetSearch) || String(s.반).includes(resetSearch))
  );

  async function handleReset(s: Student) {
    if (!confirm(
      `${s.이름} (${s.학년}-${s.반}-${s.번호}) 학생의 가입 정보를 초기화할까요?\n\n` +
      `해당 학생은 다시 가입할 수 있게 됩니다. 이미 발급된 Firebase Auth 계정은 별도 삭제 필요.`
    )) return;
    setResetting(s.id);
    try {
      await resetStudentUid(s.id);
      toast.success(`${s.이름} UID 초기화 완료`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error("초기화 실패: " + msg);
    } finally { setResetting(null); }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" /> 전역 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-700 text-sm">교사 가입 코드</Label>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)}
                className="border-gray-300 text-gray-900 bg-white" placeholder="가입 코드" />
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "저장"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-700">학생 가입 잠금</p>
              <p className="text-xs text-gray-400">잠금 시 신규 학생 가입 불가</p>
            </div>
            <button onClick={toggleLock}>
              {settings?.enrollmentLocked
                ? <ToggleRight className="w-9 h-9 text-amber-500" />
                : <ToggleLeft className="w-9 h-9 text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-700">QR 승차점호 활성</p>
              <p className="text-xs text-gray-400">비활성 시 QR 스캔 차단</p>
            </div>
            <button onClick={toggleQR}>
              {settings?.qrTokensActive
                ? <ToggleRight className="w-9 h-9 text-green-500" />
                : <ToggleLeft className="w-9 h-9 text-gray-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-700">자동 점호 (Cloud Functions 미사용)</p>
              <p className="text-xs text-gray-400">
                일정표 시각이 되면 자동으로 점호 세션 생성. 관리자 페이지가
                열려있을 때만 동작합니다.
              </p>
            </div>
            <button onClick={toggleAutoCheckin}>
              {settings?.autoCheckinEnabled
                ? <ToggleRight className="w-9 h-9 text-blue-500" />
                : <ToggleLeft className="w-9 h-9 text-gray-300" />}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-400" /> 학생 UID 초기화
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">초기화 후 해당 학생은 다시 가입할 수 있습니다. Firebase Auth 계정은 별도 삭제가 필요합니다.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={resetSearch} onChange={(e) => setResetSearch(e.target.value)}
              placeholder="이름 또는 반 검색"
              className="pl-9 border-gray-300 text-gray-900 bg-white" />
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {filteredStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-900">{s.이름}</span>
                  <span className="text-xs text-gray-500 ml-2">{s.학년}학년 {s.반}반 {s.번호}번</span>
                </div>
                <Button size="sm" variant="outline"
                  className="border-red-300 text-red-500 hover:bg-red-50 h-7 text-xs"
                  onClick={() => handleReset(s)} disabled={resetting === s.id}>
                  {resetting === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "초기화"}
                </Button>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">
                {resetSearch ? "검색 결과가 없습니다." : "가입된 학생이 없습니다."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
const DEFAULT_TRIP_START = new Date("2026-05-26T00:00:00+09:00");
const DEFAULT_TRIP_END = new Date("2026-05-29T23:59:59+09:00");

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sessions, setSessions] = useState<CheckinSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [printingQR, setPrintingQR] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  // 자동 점호 (클라이언트 폴링) — admin 페이지가 열려있을 때만 동작
  useAutoCheckin({
    uid: user?.uid,
    enabled: !!globalSettings?.autoCheckinEnabled,
    tripStart: globalSettings?.tripStartIso ? new Date(globalSettings.tripStartIso) : DEFAULT_TRIP_START,
    tripEnd: globalSettings?.tripEndIso ? new Date(globalSettings.tripEndIso) : DEFAULT_TRIP_END,
    graceMinutes: globalSettings?.graceMinutes ?? 30,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "admin") {
      router.replace(role === "teacher" ? "/teacher" : "/student");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getStudents(), getIncidents(), getSettings()])
      .then(([s, i, gs]) => {
        setStudents(s);
        setIncidents(i);
        setGlobalSettings(gs);
      })
      .catch((err) => {
        console.error("admin loadData error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("permission-denied") || msg.includes("insufficient")) {
          toast.error("권한 오류입니다. 로그아웃 후 다시 로그인해주세요.");
        } else {
          toast.error("데이터 로드 실패: " + msg);
        }
      })
      .finally(() => setDataLoading(false));
    const unsub = subscribeOpenSessions(setSessions);
    return unsub;
  }, [user]);

  async function handlePrintQR() {
    setPrintingQR(true);
    try {
      const buses = await getBuses();
      if (buses.length === 0) { toast.error("버스 데이터가 없습니다."); return; }
      await printBusQRs(buses.length);
    } catch {
      toast.error("QR 출력 준비 실패");
    } finally {
      setPrintingQR(false);
    }
  }

  // user가 null이면 (로그아웃 직후 redirect 대기 중) render 가드
  if (loading || dataLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
        <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-600" />
            </div>
            <span className="font-bold text-sm text-gray-900">관리자</span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </div>
    );
  }

  const openSessionCount = sessions.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">관리자</p>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">양현고 수학여행</p>
            </div>
          </div>
          <Button size="sm" variant="ghost"
            onClick={async () => { await signOut(); router.replace("/login"); }}
            className="text-gray-400 hover:text-gray-700">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full bg-gray-100 h-10 mb-5 p-1 rounded-xl">
            <TabsTrigger value="dashboard" className="flex-1 text-xs rounded-lg">대시보드</TabsTrigger>
            <TabsTrigger value="students" className="flex-1 text-xs rounded-lg">
              학생
              {students.length > 0 && (
                <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 rounded-full px-1.5 leading-4">
                  {students.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="teachers" className="flex-1 text-xs rounded-lg">교사</TabsTrigger>
            <TabsTrigger value="sessions" className="flex-1 text-xs rounded-lg">
              점호
              {openSessionCount > 0 && (
                <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 leading-4">
                  {openSessionCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs rounded-lg">설정</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab
              students={students} incidents={incidents} sessions={sessions}
              onPrintQR={handlePrintQR} printingQR={printingQR}
            />
          </TabsContent>
          <TabsContent value="students">
            <StudentsTab students={students} />
          </TabsContent>
          <TabsContent value="teachers">
            <TeachersTab />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsTab sessions={sessions} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab students={students} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
