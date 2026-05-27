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
  AlertTriangle, CheckCircle2, Clock, ChevronRight, ChevronLeft, Key,
  ToggleLeft, ToggleRight, Plus, X, Search, GraduationCap, Timer, Bus as BusIcon, Calendar, Phone,
  MessageCircle, Megaphone, Send, Mail, BarChart2, ClipboardList, Share2,
  PackageSearch, Trash2, MapPin,
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
import { generateBusQrDataUrl } from "@/lib/qr";
import { subscribeLostItems, updateLostItemStatus, deleteLostItem } from "@/lib/firestore";
import type {
  Student, Incident, CheckinSession, GlobalSettings, SessionScope, AppUser, Bus, LostItem, LostItemStatus,
} from "@/types";

// ── Bus QR Modal ─────────────────────────────────────────────────
function BusQrModal() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Bus | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function selectBus(bus: Bus) {
    setSelected(bus);
    setLoading(true);
    try {
      const url = await generateBusQrDataUrl(bus.호차);
      setQrUrl(url);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen() {
    setSelected(null);
    setQrUrl("");
    setOpen(true);
    if (buses.length === 0) {
      try {
        const loaded = await getBuses();
        setBuses(loaded);
      } catch {
        toast.error("버스 데이터 로드 실패");
      }
    }
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex flex-col items-center gap-1.5 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all hover:border-green-300 w-full"
      >
        <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
          <QrCode className="w-4 h-4 text-green-600" />
        </div>
        <p className="font-medium text-xs text-gray-900">버스 QR 보기</p>
        <p className="text-[10px] text-gray-400">호차별 QR 캡처·공유</p>
      </button>
    );
  }

  // QR 전체화면 뷰
  if (selected) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => { setSelected(null); setQrUrl(""); }}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-bold text-gray-900">{selected.호차}호차 QR</span>
          {selected.탑승반 && (
            <span className="ml-auto text-sm text-gray-500">{selected.탑승반}</span>
          )}
        </div>

        {/* QR 코드 영역 — 캡처용 */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 bg-white">
          <div className="text-center">
            <p className="text-5xl font-black text-gray-900 mb-1">{selected.호차}호차</p>
            {selected.탑승반 && (
              <p className="text-lg text-gray-500 font-medium">{selected.탑승반}</p>
            )}
            {selected.인솔교사1 && (
              <p className="text-sm text-gray-400 mt-0.5">
                인솔: {selected.인솔교사1}{selected.인솔교사2 ? ` · ${selected.인솔교사2}` : ""}
              </p>
            )}
          </div>

          {loading ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-gray-300 animate-spin" />
            </div>
          ) : (
            <img
              src={qrUrl}
              alt={`${selected.호차}호차 QR`}
              className="w-64 h-64 rounded-2xl border-4 border-gray-100 shadow-lg"
            />
          )}

          <p className="text-xs text-gray-400 text-center">
            화면을 캡처한 뒤 카카오톡·문자로 선생님께 전달하세요
          </p>

          <div className="flex items-center gap-1.5 text-xs text-blue-500 bg-blue-50 px-4 py-2 rounded-xl">
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            iOS: 전원+음량올리기 · Android: 전원+음량내리기
          </div>
        </div>
      </div>
    );
  }

  // 호차 목록
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <span className="font-bold text-gray-900">버스 QR 보기</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {buses.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">
            버스 데이터가 없습니다.<br />
            <span className="text-xs">엑셀 업로드에서 buses 시트를 추가하세요.</span>
          </div>
        ) : (
          buses.sort((a, b) => a.호차 - b.호차).map((bus) => (
            <button
              key={bus.id}
              onClick={() => selectBus(bus)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-green-300 hover:shadow-sm active:scale-[0.98] transition-all text-left"
            >
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{bus.호차}호차</p>
                {bus.탑승반 && <p className="text-xs text-gray-500 mt-0.5">{bus.탑승반}</p>}
                {bus.인솔교사1 && (
                  <p className="text-xs text-gray-400">
                    {bus.인솔교사1}{bus.인솔교사2 ? ` · ${bus.인솔교사2}` : ""}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

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
function DashboardTab({ students, incidents, sessions }: {
  students: Student[]; incidents: Incident[]; sessions: CheckinSession[];
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
            icon={BusIcon}
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
          <BusQrModal />
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

// ── Lost Items Tab ────────────────────────────────────────────────
const STATUS_LABEL: Record<LostItemStatus, string> = {
  lost: "분실", found: "습득", returned: "반환완료",
};
const STATUS_COLOR: Record<LostItemStatus, string> = {
  lost: "bg-red-100 text-red-700",
  found: "bg-yellow-100 text-yellow-700",
  returned: "bg-green-100 text-green-700",
};

function LostItemsTab() {
  const [items, setItems] = useState<LostItem[]>([]);
  const [filter, setFilter] = useState<LostItemStatus | "all">("all");

  useEffect(() => subscribeLostItems(setItems), []);

  async function handleStatus(item: LostItem, next: LostItemStatus) {
    await updateLostItemStatus(item.id, next);
    toast.success("상태 변경됨");
  }
  async function handleDelete(item: LostItem) {
    if (!confirm(`"${item.title}" 삭제하시겠습니까?`)) return;
    await deleteLostItem(item.id);
    toast.success("삭제됨");
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const counts = {
    all: items.length,
    lost: items.filter((i) => i.status === "lost").length,
    found: items.filter((i) => i.status === "found").length,
    returned: items.filter((i) => i.status === "returned").length,
  };

  return (
    <div className="space-y-4">
      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-2">
        {(["lost", "found", "returned"] as LostItemStatus[]).map((s) => (
          <div key={s} className={`rounded-xl p-3 text-center ${STATUS_COLOR[s]} bg-opacity-50`}>
            <p className="text-xl font-black">{counts[s]}</p>
            <p className="text-xs font-medium mt-0.5">{STATUS_LABEL[s]}</p>
          </div>
        ))}
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["all", "lost", "found", "returned"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            {f === "all" ? "전체" : STATUS_LABEL[f]}
            <span className={`ml-1 ${filter === f ? "text-blue-200" : "text-gray-400"}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-400 text-sm shadow-sm">
          <PackageSearch className="w-8 h-8 mx-auto mb-2 opacity-30" />
          등록된 항목이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{item.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  {item.description && <p className="text-xs text-gray-500 mb-1">{item.description}</p>}
                  {item.location && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                      <MapPin className="w-3 h-3" />{item.location}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{item.reporterName}</p>
                </div>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* 상태 변경 버튼 */}
              {item.status !== "returned" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {item.status === "lost" && (
                    <button
                      onClick={() => handleStatus(item, "found")}
                      className="flex-1 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 py-1.5 rounded-lg transition-colors"
                    >
                      습득 처리
                    </button>
                  )}
                  <button
                    onClick={() => handleStatus(item, "returned")}
                    className="flex-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 py-1.5 rounded-lg transition-colors"
                  >
                    반환 완료
                  </button>
                </div>
              )}
            </div>
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
          <TabsList className="w-full h-auto mb-5 p-0 bg-transparent flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">

            <TabsTrigger
              value="dashboard"
              className="relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 bg-white border-gray-200 text-gray-500 shadow-sm hover:border-blue-300 hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <BarChart2 className="w-4 h-4" />
              대시보드
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 bg-white border-gray-200 text-gray-500 shadow-sm hover:border-blue-300 hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Users className="w-4 h-4" />
              <span className="flex items-center gap-0.5">
                학생
                {students.length > 0 && (
                  <span className="text-[9px] opacity-70">({students.length})</span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="teachers"
              className="relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 bg-white border-gray-200 text-gray-500 shadow-sm hover:border-blue-300 hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <GraduationCap className="w-4 h-4" />
              교사
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 bg-white border-gray-200 text-gray-500 shadow-sm hover:border-amber-300 hover:text-amber-600 data-[state=active]:bg-blue-600 data-[state=active]:border-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="flex items-center gap-0.5">
                점호
                {openSessionCount > 0 && (
                  <span className="text-[9px] opacity-70">({openSessionCount})</span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 bg-white border-gray-200 text-gray-500 shadow-sm hover:border-blue-300 hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Settings className="w-4 h-4" />
              설정
            </TabsTrigger>
            <TabsTrigger
              value="lostItems"
              className="relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 bg-white border-gray-200 text-gray-500 shadow-sm hover:border-orange-300 hover:text-orange-600 data-[state=active]:bg-blue-600 data-[state=active]:border-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <PackageSearch className="w-4 h-4" />
              분실물
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab
              students={students} incidents={incidents} sessions={sessions}
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
          <TabsContent value="lostItems">
            <LostItemsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
