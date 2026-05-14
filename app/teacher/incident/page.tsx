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
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createIncident, getIncidents, updateIncident, getStudents } from "@/lib/firestore";
import type { Incident, IncidentSeverity, Student } from "@/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  CRITICAL: "위급",
  MAJOR: "중요",
  MINOR: "경미",
};
const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  CRITICAL: "border-red-600 text-red-400",
  MAJOR: "border-amber-600 text-amber-400",
  MINOR: "border-blue-700 text-blue-400",
};

const INCIDENT_TYPES = ["건강/부상", "분실/도난", "무단이탈", "규정위반", "사고", "기타"];

// ── 등록 폼 ──────────────────────────────────────────────────────
function CreateIncidentForm({ uid, students, onCreated }: {
  uid: string;
  students: Student[];
  onCreated: () => void;
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
      s.이름.includes(studentSearch) ||
      String(s.반).includes(studentSearch) ||
      String(s.번호).includes(studentSearch)
    ).slice(0, 5);
  }, [students, studentSearch]);

  function addStudent(s: Student) {
    if (!selected.find((x) => x.id === s.id)) setSelected([...selected, s]);
    setStudentSearch("");
  }

  function removeStudent(id: string) {
    setSelected(selected.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!내용.trim()) { toast.error("내용을 입력해주세요."); return; }
    setBusy(true);
    try {
      await createIncident({
        유형,
        심각도,
        관련학생: selected.map((s) => `/students/${s.id}`),
        내용: 내용.trim(),
        조치: 조치.trim(),
        종결여부: false,
        byUid: uid,
      });
      toast.success("사건사고가 등록되었습니다.");
      setOpen(false);
      set내용("");
      set조치("");
      setSelected([]);
      onCreated();
    } catch {
      toast.error("등록 실패. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="w-4 h-4" /> 사건사고 등록
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            사건사고 등록
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">유형</Label>
              <Select value={유형} onValueChange={(v) => { if (v !== null) set유형(v); }}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">심각도</Label>
              <Select value={심각도} onValueChange={(v) => set심각도(v as IncidentSeverity)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="CRITICAL">위급</SelectItem>
                  <SelectItem value="MAJOR">중요</SelectItem>
                  <SelectItem value="MINOR">경미</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">관련 학생 (선택)</Label>
            <Input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="이름 또는 반·번호 검색"
              className="bg-slate-800 border-slate-600 text-slate-100"
            />
            {searchResults.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 border-b border-slate-700 last:border-0"
                    onClick={() => addStudent(s)}
                  >
                    {s.이름} ({s.학년}학년 {s.반}반 {s.번호}번)
                  </button>
                ))}
              </div>
            )}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="border-blue-700 text-blue-300 cursor-pointer"
                    onClick={() => removeStudent(s.id)}
                  >
                    {s.이름} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">내용 *</Label>
            <textarea
              value={내용}
              onChange={(e) => set내용(e.target.value)}
              placeholder="상황 설명"
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">조치 사항</Label>
            <textarea
              value={조치}
              onChange={(e) => set조치(e.target.value)}
              placeholder="취한 조치 또는 예정 조치"
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}등록
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── 인시던트 카드 ────────────────────────────────────────────────
function IncidentCard({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const ts = incident.timestamp?.toDate?.();
  const timeStr = ts
    ? `${ts.getMonth() + 1}/${ts.getDate()} ${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`
    : "";

  async function handleClose() {
    setClosing(true);
    try {
      await updateIncident(incident.id, { 종결여부: true });
      toast.success("종결 처리되었습니다.");
      onClose();
    } finally {
      setClosing(false);
    }
  }

  return (
    <Card className={`border ${incident.종결여부 ? "border-slate-800 opacity-60" : SEVERITY_COLOR[incident.심각도].split(" ")[0] + " border"}`}>
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={SEVERITY_COLOR[incident.심각도]}>
              {SEVERITY_LABEL[incident.심각도]}
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {incident.유형}
            </Badge>
            {incident.종결여부 && (
              <Badge variant="outline" className="border-green-700 text-green-400">종결</Badge>
            )}
          </div>
          <span className="text-xs text-slate-500 shrink-0">{timeStr}</span>
        </div>

        <p className="text-sm">{incident.내용}</p>
        {incident.조치 && (
          <p className="text-xs text-slate-400">조치: {incident.조치}</p>
        )}
        {incident.관련학생.length > 0 && (
          <p className="text-xs text-slate-500">
            관련: {incident.관련학생.map((r) => r.split("/").pop()).join(", ")}
          </p>
        )}

        {!incident.종결여부 && (
          <Button
            size="sm" variant="outline"
            className="border-green-700 text-green-400 mt-1"
            onClick={handleClose} disabled={closing}
          >
            {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            종결 처리
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
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
    const [i, s] = await Promise.all([getIncidents(), getStudents()]);
    setIncidents(i);
    setStudents(s);
    setDataLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const open = incidents.filter((i) => !i.종결여부);
  const closed = incidents.filter((i) => i.종결여부);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher">
              <Button size="sm" variant="ghost" className="text-slate-400 p-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-bold">사건사고 관리</span>
          </div>
          {user && (
            <CreateIncidentForm uid={user.uid} students={students} onCreated={loadData} />
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 진행 중 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            처리 중 ({open.length}건)
          </p>
          {open.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">처리 중인 사건사고가 없습니다.</p>
          ) : (
            open.map((i) => (
              <IncidentCard key={i.id} incident={i} onClose={loadData} />
            ))
          )}
        </div>

        {/* 종결 */}
        {closed.length > 0 && (
          <div className="space-y-2">
            <button
              className="text-xs font-medium text-slate-500 flex items-center gap-1.5 hover:text-slate-300"
              onClick={() => setShowClosed(!showClosed)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              종결된 건 ({closed.length}건) {showClosed ? "접기" : "펼치기"}
            </button>
            {showClosed && closed.map((i) => (
              <IncidentCard key={i.id} incident={i} onClose={loadData} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
