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
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Key, Printer,
  ToggleLeft, ToggleRight, Plus, X, Search, GraduationCap, Timer, Bus, Calendar, Phone,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/auth";
import {
  getStudents, getIncidents, subscribeOpenSessions,
  getSettings, updateSettings, resetStudentUid,
  getBuses, createManualSession, closeSession, extendSession, getTeachers,
} from "@/lib/firestore";
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
      await createManualSession({
        type,
        scope,
        name: name.trim() || `${type} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
        durationMinutes: duration,
        openedBy: user!.uid,
      });
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

// ── Dashboard Tab ─────────────────────────────────────────────────
function DashboardTab({ students, incidents, sessions, onPrintQR, printingQR }: {
  students: Student[]; incidents: Incident[]; sessions: CheckinSession[];
  onPrintQR: () => void; printingQR: boolean;
}) {
  const registered = students.filter((s) => s.uid).length;
  const openIncidents = incidents.filter((i) => !i.종결여부).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="전체 학생" value={students.length} sub={`가입 ${registered}명`}
          color="text-blue-600" bg="bg-blue-50" icon={Users} />
        <StatCard label="진행 중 점호" value={sessions.length} sub="활성 세션"
          color="text-amber-500" bg="bg-amber-50" icon={Clock} />
        <StatCard label="미처리 사건" value={openIncidents} sub="건"
          color={openIncidents > 0 ? "text-red-500" : "text-gray-400"}
          bg={openIncidents > 0 ? "bg-red-50" : "bg-gray-50"} icon={AlertTriangle} />
        <StatCard label="전체 사건" value={incidents.length} sub="누적"
          color="text-gray-500" bg="bg-gray-100" icon={CheckCircle2} />
      </div>

      {sessions.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">진행 중인 점호</p>
          <div className="space-y-2">
            {sessions.slice(0, 2).map((s) => {
              const min = Math.max(0, Math.round((s.endAt.toDate().getTime() - Date.now()) / 60000));
              return (
                <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.scope} · {min}분 남음</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">바로가기</p>

        <Link href="/schedule">
          <Card className="bg-white border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">여행 일정</p>
                  <p className="text-xs text-gray-500">일차별 일정표</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/contacts">
          <Card className="bg-white border-gray-200 shadow-sm hover:border-green-400 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">비상 연락처</p>
                  <p className="text-xs text-gray-500">긴급 연락처 조회</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/boarding">
          <Card className="bg-white border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Bus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">승차 현황 모니터링</p>
                  <p className="text-xs text-gray-500">전체 반 탑승 실시간 현황</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/upload">
          <Card className="bg-white border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">Excel 데이터 업로드</p>
                  <p className="text-xs text-gray-500">학생·호실·일정·버스·연락처</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <QrCode className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">버스 QR 인쇄</p>
                <p className="text-xs text-gray-500">호차별 QR 코드 출력</p>
              </div>
            </div>
            <Button size="sm" variant="outline"
              className="border-green-400 text-green-600 hover:bg-green-50"
              onClick={onPrintQR} disabled={printingQR}>
              {printingQR ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            </Button>
          </CardContent>
        </Card>

        <Link href="/teacher/checkin?session=latest">
          <Card className="bg-white border-gray-200 shadow-sm hover:border-amber-400 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">점호 현황 보기</p>
                  <p className="text-xs text-gray-500">교사 점호 뷰로 이동</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/incident">
          <Card className="bg-white border-gray-200 shadow-sm hover:border-red-400 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">사건사고 관리</p>
                  <p className="text-xs text-gray-500">
                    {openIncidents > 0 ? `미처리 ${openIncidents}건` : "모두 처리됨"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
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

  useEffect(() => {
    getTeachers().then((t) => {
      setTeachers(t.sort((a, b) =>
        ((a.담임학년 ?? 99) - (b.담임학년 ?? 99)) || ((a.담임반 ?? 99) - (b.담임반 ?? 99))
      ));
      setLoading(false);
    });
  }, []);

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
          <div>
            <p className="font-semibold text-sm text-gray-900">{t.이름 || "(이름 없음)"}</p>
            <p className="text-xs text-gray-500">
              {t.담임학년 && t.담임반
                ? `${t.담임학년}학년 ${t.담임반}반 담임`
                : "담임 미지정"}
            </p>
          </div>
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

  const filteredStudents = students.filter(
    (s) => s.uid && (!resetSearch || s.이름.includes(resetSearch) || String(s.반).includes(resetSearch))
  );

  async function handleReset(s: Student) {
    setResetting(s.id);
    try {
      await resetStudentUid(s.id);
      toast.success(`${s.이름} UID 초기화 완료`);
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
export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sessions, setSessions] = useState<CheckinSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [printingQR, setPrintingQR] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "admin") {
      router.replace(role === "teacher" ? "/teacher" : "/student");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getStudents(), getIncidents()]).then(([s, i]) => {
      setStudents(s);
      setIncidents(i);
      setDataLoading(false);
    });
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

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const openSessionCount = sessions.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
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
