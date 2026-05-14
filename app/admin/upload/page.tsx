"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle,
  Loader2, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { parseExcel, type SheetDebugInfo } from "@/lib/excel";
import {
  batchUpsertStudents, batchUpsertRooms, batchUpsertSchedule,
  batchUpsertBuses, batchUpsertContacts, fixScheduleCheckinTypes,
  syncTeacherHomerooms,
} from "@/lib/firestore";

interface ParsedData {
  students: ReturnType<typeof parseExcel>["students"];
  rooms: ReturnType<typeof parseExcel>["rooms"];
  schedule: ReturnType<typeof parseExcel>["schedule"];
  buses: ReturnType<typeof parseExcel>["buses"];
  contacts: ReturnType<typeof parseExcel>["contacts"];
  debugInfo: SheetDebugInfo[];
}

type UploadStatus = "idle" | "parsing" | "preview" | "uploading" | "done" | "error";

const SHEET_LABELS = [
  { key: "students", label: "학생 명단" },
  { key: "rooms", label: "호실 정보" },
  { key: "schedule", label: "일정표" },
  { key: "buses", label: "버스 정보" },
  { key: "contacts", label: "비상 연락처" },
] as const;

const ILCHA_ALIASES = ["일차", "Day", "날짜", "일", "차수", "일자", "구분", "day"];
const TIME_ALIASES = ["시작시각", "시작", "시작시간", "Start", "시작 시각", "시작 시간", "start"];

function ScheduleDiag({ parsed }: { parsed: ParsedData }) {
  const [open, setOpen] = useState(false);
  const schedInfo = parsed.debugInfo.find((d) => d.sheet === "schedule");
  const cols = schedInfo?.columns ?? [];
  const hasIlcha = cols.some((c) => ILCHA_ALIASES.includes(c));
  const hasTime = cols.some((c) => TIME_ALIASES.includes(c));
  const items = parsed.schedule.slice(0, 5);
  const days = Array.from(new Set(parsed.schedule.map((s) => s.일차))).sort((a, b) => a - b);

  return (
    <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100"
      >
        <span className="font-medium">일정표 진단 정보</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 text-xs">
          <div>
            <span className="text-gray-400">감지된 컬럼: </span>
            <span className="font-mono text-gray-700">{cols.join(", ") || "(없음)"}</span>
          </div>
          {!hasIlcha && (
            <div className="flex items-start gap-1.5 bg-red-50 border border-red-200 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 font-semibold">일차 컬럼 미감지</p>
                <p className="text-red-600">인식 가능한 컬럼명: {ILCHA_ALIASES.join(", ")}</p>
                <p className="text-red-600">실제 컬럼명을 위 중 하나로 변경하세요.</p>
              </div>
            </div>
          )}
          {!hasTime && (
            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-700 font-semibold">시작시각 컬럼 미감지</p>
                <p className="text-amber-600">인식 가능한 컬럼명: {TIME_ALIASES.join(", ")}</p>
              </div>
            </div>
          )}
          {hasIlcha && (
            <div>
              <span className="text-gray-400">감지된 일차: </span>
              <span className="text-gray-700">{days.join(", ")}일차</span>
            </div>
          )}
          {items.length > 0 && (
            <div>
              <p className="text-gray-400 mb-1">첫 5개 항목:</p>
              {items.map((ev, i) => (
                <p key={i} className="font-mono text-gray-600">
                  {ev.일차}일차 {ev.시작시각} {ev.일정명}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminUploadPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadedSheets, setUploadedSheets] = useState<string[]>([]);
  const [fixingCheckin, setFixingCheckin] = useState(false);
  const [syncingHomerooms, setSyncingHomerooms] = useState(false);

  async function handleFixCheckin() {
    setFixingCheckin(true);
    try {
      await fixScheduleCheckinTypes();
      toast.success("점호 유형이 일괄 적용되었습니다!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "적용 실패");
    } finally {
      setFixingCheckin(false);
    }
  }

  async function handleSyncHomerooms() {
    setSyncingHomerooms(true);
    try {
      const count = await syncTeacherHomerooms();
      toast.success(`담임 정보 동기화 완료 (${count}명 업데이트)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "동기화 실패");
    } finally {
      setSyncingHomerooms(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "admin") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Excel 파일(.xlsx, .xls)만 업로드 가능합니다.");
      return;
    }
    setStatus("parsing");
    setErrorMsg("");
    try {
      const buf = await file.arrayBuffer();
      const data = parseExcel(buf);
      setParsed(data);
      setStatus("preview");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "파싱 오류");
      setStatus("error");
    }
  }

  async function handleUpload() {
    if (!parsed) return;
    setStatus("uploading");
    setUploadedSheets([]);
    const tasks: Array<[string, () => Promise<void>]> = [
      ["students", () => batchUpsertStudents(parsed.students)],
      ["rooms", () => batchUpsertRooms(parsed.rooms)],
      ["schedule", () => batchUpsertSchedule(parsed.schedule)],
      ["buses", () => batchUpsertBuses(parsed.buses)],
      ["contacts", () => batchUpsertContacts(parsed.contacts)],
    ];
    try {
      for (const [key, fn] of tasks) {
        await fn();
        setUploadedSheets((prev) => [...prev, key]);
      }
      setStatus("done");
      toast.success("모든 데이터가 업로드되었습니다!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "업로드 오류");
      setStatus("error");
    }
  }

  function handleReset() {
    setParsed(null);
    setStatus("idle");
    setErrorMsg("");
    setUploadedSheets([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin">
            <Button size="sm" variant="ghost" className="text-gray-500 p-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-bold text-gray-900">Excel 데이터 업로드</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-semibold">업로드 전 확인사항</p>
                <p>Excel 파일은 5개 시트: <strong>students, rooms, schedule, buses, contacts</strong></p>
                <p>각 시트의 <strong>1행이 컬럼 헤더</strong>여야 합니다 (설명 행 없이 바로 헤더).</p>
                <p>학생 데이터는 uid/createdAt을 유지한 채 upsert됩니다.</p>
                <p>일정·연락처는 기존 데이터를 모두 삭제 후 재업로드됩니다.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(status === "idle" || status === "error") && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="pt-6 pb-6">
              <label className="flex flex-col items-center gap-4 cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-green-500 opacity-80" />
                <div className="text-center">
                  <p className="font-medium text-gray-900">Excel 파일 선택</p>
                  <p className="text-sm text-gray-400 mt-1">.xlsx / .xls</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                <Button type="button" className="pointer-events-none">
                  <Upload className="w-4 h-4 mr-2" /> 파일 선택
                </Button>
              </label>
              {status === "error" && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {status === "parsing" && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="py-10 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-gray-500">Excel 파싱 중...</p>
            </CardContent>
          </Card>
        )}

        {(status === "preview" || status === "uploading" || status === "done") && parsed && (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900">파싱 결과 미리보기</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {SHEET_LABELS.map(({ key, label }) => {
                const count = parsed[key].length;
                const uploaded = uploadedSheets.includes(key);
                const isUploading = status === "uploading" && !uploaded &&
                  uploadedSheets.length === SHEET_LABELS.findIndex((s) => s.key === key);
                return (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      {uploaded ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-sm text-gray-800">{label}</span>
                    </div>
                    <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                      {count}건
                    </Badge>
                  </div>
                );
              })}
              <ScheduleDiag parsed={parsed} />
            </CardContent>
          </Card>
        )}

        {status === "preview" && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-gray-300 text-gray-600" onClick={handleReset}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleUpload}>
              <Upload className="w-4 h-4 mr-2" /> Firestore에 업로드
            </Button>
          </div>
        )}

        {status === "uploading" && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-500">업로드 중... ({uploadedSheets.length}/{SHEET_LABELS.length})</span>
          </div>
        )}

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-900">일정 점호 유형 일괄 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">
              <strong>학교 집결</strong>, <strong>숙소 도착 후 휴식</strong> → 정시점호<br />
              나머지 전체 일정 → 승차점호
            </p>
            <Button onClick={handleFixCheckin} disabled={fixingCheckin} className="w-full">
              {fixingCheckin && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Firestore 일괄 적용
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-900">담임 정보 동기화</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-3">
              버스 시트의 <strong>인솔교사1</strong> 이름과 <strong>탑승반</strong>을 기반으로<br />
              교사 계정의 담임반을 자동 설정합니다.
            </p>
            <Button onClick={handleSyncHomerooms} disabled={syncingHomerooms} className="w-full">
              {syncingHomerooms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              담임 정보 동기화
            </Button>
          </CardContent>
        </Card>

        {status === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">업로드 완료!</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-gray-300 text-gray-600" onClick={handleReset}>
                다시 업로드
              </Button>
              <Link href="/admin" className="flex-1">
                <Button className="w-full">대시보드로</Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
