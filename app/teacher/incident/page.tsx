"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, AlertTriangle, Plus, Loader2, CheckCircle2,
  Clock, Users, ClipboardCheck, Siren,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createIncident, getIncidents, updateIncident, getStudents } from "@/lib/firestore";
import type { Incident, IncidentSeverity, Student } from "@/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  CRITICAL: "위급", MAJOR: "중요", MINOR: "경미",
};
const SEVERITY_BADGE: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-500 text-white border-red-500",
  MAJOR: "bg-amber-500 text-white border-amber-500",
  MINOR: "bg-blue-500 text-white border-blue-500",
};
const SEVERITY_BORDER: Record<IncidentSeverity, string> = {
  CRITICAL: "border-red-300", MAJOR: "border-amber-300", MINOR: "border-blue-200",
};
const SEVERITY_ACCENT: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-gradient-to-r from-red-500 to-rose-600",
  MAJOR: "bg-gradient-to-r from-amber-500 to-orange-500",
  MINOR: "bg-gradient-to-r from-blue-500 to-sky-500",
};
const SEVERITY_ICON_BG: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-50",
  MAJOR: "bg-amber-50",
  MINOR: "bg-blue-50",
};
const SEVERITY_ICON_FG: Record<IncidentSeverity, string> = {
  CRITICAL: "text-red-500",
  MAJOR: "text-amber-500",
  MINOR: "text-blue-500",
};

const INCIDENT_TYPES = ["건강/부상", "분실/도난", "무단이탈", "규정위반", "사고", "기타"];

function CreateIncidentForm({ uid, students, onCreated }: {
  uid: string; students: Student[]; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [유형, set유형] = useState("건강/부상");
  const [심각도, set심각도] = useState<IncidentSeverity>("MINOR");
  const [내용, set내용] = useState("");
  const [조치, set조치] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selected, setSelected] = useState<Student[]>([]);
  const [busy, setBusy] = useState(false);

  const searchResults = useMemo(() => {
    if (!studentSearch.trim()) return [];
    return students.filter((s) =>
      s.이름.includes(studentSearch) || String(s.반).includes(studentSearch) || String(s.번호).includes(studentSearch)
    ).slice(0, 5);
  }, [students, studentSearch]);

  function addStudent(s: Student) {
    if (!selected.find((x) => x.id === s.id)) setSelected([...selected, s]);
    setStudentSearch("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!내용.trim()) { toast.error("내용을 입력해주세요."); return; }
    setBusy(true);
    try {
      await createIncident({
        유형, 심각도,
        관련학생: selected.map((s) => `/students/${s.id}`),
        내용: 내용.trim(), 조치: 조치.trim(), 종결여부: false, byUid: uid,
      });
      toast.success("사건사고가 등록되었습니다.");
      setOpen(false); set내용(""); set조치(""); setSelected([]);
      onCreated();
    } catch { toast.error("등록 실패. 다시 시도해주세요."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-4 h-4" /> 사건사고 등록
      </DialogTrigger>
      <DialogContent className="bg-white border-gray-200 text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> 사건사고 등록
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-gray-700">유형</Label>
            <div className="flex flex-wrap gap-1.5">
              {INCIDENT_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => set유형(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    유형 === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">심각도</Label>
            <div className="flex gap-2">
              {([["CRITICAL", "위급"], ["MAJOR", "중요"], ["MINOR", "경미"]] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => set심각도(val)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    심각도 === val
                      ? val === "CRITICAL" ? "bg-red-500 text-white border-red-500"
                        : val === "MAJOR" ? "bg-amber-500 text-white border-amber-500"
                        : "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">관련 학생 (선택)</Label>
            <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="이름 또는 반·번호 검색"
              className="border-gray-300 text-gray-900 bg-white" />
            {searchResults.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {searchResults.map((s) => (
                  <button key={s.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    onClick={() => addStudent(s)}>
                    {s.이름} ({s.학년}학년 {s.반}반 {s.번호}번)
                  </button>
                ))}
              </div>
            )}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((s) => (
                  <Badge key={s.id} variant="outline"
                    className="border-blue-300 text-blue-700 bg-blue-50 cursor-pointer"
                    onClick={() => setSelected(selected.filter((x) => x.id !== s.id))}>
                    {s.이름} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">내용 *</Label>
            <textarea value={내용} onChange={(e) => set내용(e.target.value)}
              placeholder="상황 설명" rows={3} required
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700">조치 사항</Label>
            <textarea value={조치} onChange={(e) => set조치(e.target.value)}
              placeholder="취한 조치 또는 예정 조치" rows={2}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}등록
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentCard({ incident, students, onClose }: {
  incident: Incident;
  students: Student[];
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const ts = incident.timestamp?.toDate?.();
  const timeStr = ts
    ? `${ts.getMonth() + 1}/${ts.getDate()} ${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`
    : "";
  const isCritical = incident.심각도 === "CRITICAL" && !incident.종결여부;

  // 관련 학생 ID → 이름 매핑
  const relatedStudents = incident.관련학생
    .map((r) => students.find((s) => `/students/${s.id}` === r) ?? null)
    .filter((s): s is Student => s !== null);

  async function handleClose() {
    setClosing(true);
    try {
      await updateIncident(incident.id, { 종결여부: true });
      toast.success("종결 처리되었습니다.");
      onClose();
    } finally { setClosing(false); }
  }

  return (
    <Card className={`overflow-hidden shadow-sm transition-all hover:shadow-md ${
      incident.종결여부
        ? "border-gray-200 bg-gray-50/50 opacity-75"
        : `border ${SEVERITY_BORDER[incident.심각도]} bg-white`
    } ${isCritical ? "ring-2 ring-red-300/70" : ""}`}>
      {/* 심각도 컬러 띠 */}
      {!incident.종결여부 && (
        <div className={`h-1 ${SEVERITY_ACCENT[incident.심각도]}`} />
      )}
      <CardContent className="pt-4 pb-3 space-y-3">
        {/* 헤더: 아이콘 + 유형/심각도 + 시각 */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            incident.종결여부 ? "bg-gray-100" : SEVERITY_ICON_BG[incident.심각도]
          }`}>
            {isCritical
              ? <Siren className={`w-5 h-5 ${SEVERITY_ICON_FG[incident.심각도]}`} />
              : <AlertTriangle className={`w-5 h-5 ${
                  incident.종결여부 ? "text-gray-400" : SEVERITY_ICON_FG[incident.심각도]
                }`} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={`text-[10px] py-0 px-1.5 leading-tight font-bold ${
                incident.종결여부
                  ? "bg-gray-200 text-gray-500 border-gray-300"
                  : SEVERITY_BADGE[incident.심각도]
              }`}>
                {SEVERITY_LABEL[incident.심각도]}
              </Badge>
              <Badge variant="outline" className="border-gray-300 text-gray-600 bg-white text-[10px] py-0 px-1.5 leading-tight">
                {incident.유형}
              </Badge>
              {incident.종결여부 && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] py-0 px-1.5 leading-tight">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />종결
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{timeStr}</span>
            </div>
          </div>
        </div>

        {/* 내용 */}
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {incident.내용}
        </p>

        {/* 조치 — 강조 표시 */}
        {incident.조치 && (
          <div className="bg-gray-50 border-l-2 border-gray-300 px-3 py-2 rounded-r">
            <p className="flex items-start gap-1.5 text-xs text-gray-600">
              <ClipboardCheck className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold text-gray-700">조치 </span>
                {incident.조치}
              </span>
            </p>
          </div>
        )}

        {/* 관련 학생 */}
        {relatedStudents.length > 0 && (
          <div className="flex items-start gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {relatedStudents.map((s) => (
                <Badge key={s.id} variant="outline"
                  className="border-blue-200 text-blue-700 bg-blue-50 text-[10px] py-0 px-1.5 leading-tight">
                  {s.이름} <span className="text-blue-400 ml-0.5">{s.학년}-{s.반}-{s.번호}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!incident.종결여부 && (
          <Button size="sm" variant="outline"
            className="w-full border-green-300 text-green-600 hover:bg-green-50 mt-1"
            onClick={handleClose} disabled={closing}>
            {closing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            종결 처리
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function TeacherIncidentPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "teacher" && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  async function loadData() {
    try {
      const [i, s] = await Promise.all([getIncidents(), getStudents()]);
      setIncidents(i); setStudents(s);
    } catch (err) {
      console.error("incident loadData error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("permission-denied") || msg.includes("Missing or insufficient")) {
        toast.error("권한 오류입니다. 로그아웃 후 다시 로그인해주세요.");
      } else {
        toast.error("데이터 로드 실패: " + msg);
      }
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const open = incidents.filter((i) => !i.종결여부);
  const closed = incidents.filter((i) => i.종결여부);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher">
              <Button size="sm" variant="ghost" className="text-gray-500 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-bold text-gray-900">사건사고 관리</span>
          </div>
          {user && <CreateIncidentForm uid={user.uid} students={students} onCreated={loadData} />}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            처리 중 ({open.length}건)
          </p>
          {open.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">처리 중인 사건사고가 없습니다.</p>
          ) : (
            open.map((i) => <IncidentCard key={i.id} incident={i} students={students} onClose={loadData} />)
          )}
        </div>

        {closed.length > 0 && (
          <div className="space-y-2">
            <button
              className="text-xs font-medium text-gray-400 flex items-center gap-1.5 hover:text-gray-600"
              onClick={() => setShowClosed(!showClosed)}>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              종결된 건 ({closed.length}건) {showClosed ? "접기" : "펼치기"}
            </button>
            {showClosed && closed.map((i) => <IncidentCard key={i.id} incident={i} students={students} onClose={loadData} />)}
          </div>
        )}
      </main>
    </div>
  );
}
