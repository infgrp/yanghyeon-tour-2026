import * as XLSX from "xlsx";
import type { Student, Schedule, Bus, Contact, CheckinType } from "@/types";

const SHEET_ALIASES: Record<string, string[]> = {
  students: ["students", "1_students", "학생", "학생명단", "학생목록", "Students"],
  rooms:    ["rooms",    "2_rooms",    "호실", "호실정보", "객실", "Rooms"],
  schedule: ["schedule", "3_schedule", "일정", "일정표", "스케줄", "Schedule"],
  buses:    ["buses",    "4_buses",    "버스", "버스정보", "호차", "Buses"],
  contacts: ["contacts", "5_contacts", "연락처", "비상연락처", "긴급연락처", "Contacts"],
};

// 각 시트에서 반드시 있어야 하는 컬럼 (헤더 행 자동 감지에 사용)
const ANCHOR_COLS: Record<string, string[]> = {
  students: ["이름"],
  rooms:    ["호실"],
  schedule: ["일정명"],
  buses:    ["호차"],
  contacts: ["이름"],
};

export type SheetDebugInfo = { sheet: string; columns: string[] };

function readSheet(wb: XLSX.WorkBook, name: string): { rows: Record<string, unknown>[]; columns: string[] } {
  const aliases = SHEET_ALIASES[name] ?? [name];
  const anchors = ANCHOR_COLS[name] ?? [];

  const hasAnchor = (rows: Record<string, unknown>[]) =>
    rows.length > 0 && anchors.some((a) => Object.keys(rows[0]).includes(a));

  for (const alias of aliases) {
    const ws = wb.Sheets[alias];
    if (!ws) continue;

    // 1순위: 헤더가 1행에 있는 표준 엑셀 형식 (range 미지정)
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (!hasAnchor(rows)) {
      // 2순위: 0행에 설명 행이 있고 헤더가 2행에 있는 경우 (range: 1)
      const rows1 = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", range: 1 });
      if (hasAnchor(rows1)) rows = rows1;
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    console.log(`[excel:${name}] 감지된 컬럼:`, columns);
    if (rows.length > 0) console.log(`[excel:${name}] 첫 데이터행:`, rows[0]);
    return { rows, columns };
  }

  const available = wb.SheetNames.join(", ");
  throw new Error(`시트 '${name}'를 찾을 수 없습니다. 파일의 시트명: [${available}]`);
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
function num(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function bool(v: unknown): boolean {
  const s = str(v).toUpperCase();
  return s === "Y" || s === "TRUE" || s === "1" || s === "예";
}

// "1일차", "2일차", "1", 1 등 다양한 일차 표현 → 숫자
function dayNum(v: unknown): number {
  const s = str(v);
  const m = s.match(/^(\d+)/);  // 앞의 숫자만 추출 ("1일차" → 1)
  if (m) return parseInt(m[1], 10);
  return num(v);
}

// Excel 시간 직렬값(소수) → "HH:MM" 변환
function excelTime(v: unknown): string {
  if (v === "" || v == null) return "";
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return s;
  const n = Number(v);
  if (!isNaN(n) && n > 0 && n < 1) {
    const totalMins = Math.round(n * 1440);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return s;
}

// 여러 후보 컬럼명 중 값이 있는 첫 번째를 반환
function firstVal(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

export function parseExcel(file: ArrayBuffer): {
  students: Omit<Student, "id" | "uid" | "createdAt">[];
  rooms: Omit<import("@/types").Room, "id">[];
  schedule: Omit<Schedule, "id">[];
  buses: Omit<Bus, "id">[];
  contacts: Omit<Contact, "id">[];
  debugInfo: SheetDebugInfo[];
} {
  const wb = XLSX.read(file, { type: "array", cellDates: false });
  const debugInfo: SheetDebugInfo[] = [];

  // ── Sheet1: students ──────────────────────────────────────
  const { rows: studentRows, columns: studentCols } = readSheet(wb, "students");
  debugInfo.push({ sheet: "students", columns: studentCols });
  const students = studentRows
    .filter((r) => r["이름"])
    .map((r) => ({
      학년: num(r["학년"]),
      반: num(r["반"]),
      번호: num(r["번호"]),
      이름: str(r["이름"]),
      호차: num(r["호차"]),
      호실: str(r["호실"]),
      층: num(r["층"]),
      학생연락처: str(r["학생연락처"]),
      보호자연락처: str(r["보호자연락처"]),
      건강요주의사항: str(r["건강요주의사항"]),
      특이사항: str(r["특이사항"]),
      잔류여부: bool(r["잔류여부"]),
      요양호여부: bool(r["요양호여부"]),
      비행편: str(r["비행편"]),
    }));

  // ── Sheet2: rooms ─────────────────────────────────────────
  const { rows: roomRows, columns: roomCols } = readSheet(wb, "rooms");
  debugInfo.push({ sheet: "rooms", columns: roomCols });
  const rooms = roomRows
    .filter((r) => r["호실"])
    .map((r) => ({
      호실: str(r["호실"]),
      층: num(r["층"]),
      담당교사: str(r["담당교사"]),
      정원: num(r["정원"]),
      특이사항: str(r["특이사항"]),
    }));

  // ── Sheet3: schedule ──────────────────────────────────────
  const { rows: scheduleRows, columns: scheduleCols } = readSheet(wb, "schedule");
  debugInfo.push({ sheet: "schedule", columns: scheduleCols });
  const schedule = scheduleRows
    .filter((r) => r["일정명"])
    .map((r) => ({
      일차: dayNum(firstVal(r, "일차", "Day", "날짜", "일", "차수", "일자", "구분", "day")),
      시작시각: excelTime(firstVal(r, "시작시각", "시작", "시작시간", "Start", "시작 시각", "시작 시간", "start")),
      종료시각: excelTime(firstVal(r, "종료시각", "종료", "종료시간", "End", "종료 시각", "종료 시간", "end")),
      일정명: str(r["일정명"]),
      장소: str(r["장소"]),
      점호유형: (str(r["점호유형"]) || null) as CheckinType,
      비고: str(r["비고"]),
    }));

  // ── Sheet4: buses ─────────────────────────────────────────
  const { rows: busRows, columns: busCols } = readSheet(wb, "buses");
  debugInfo.push({ sheet: "buses", columns: busCols });
  const buses = busRows
    .filter((r) => r["호차"])
    .map((r) => ({
      호차: num(r["호차"]),
      탑승반: str(r["탑승반"]),
      인솔교사1: str(r["인솔교사1"]),
      인솔교사2: str(r["인솔교사2"]),
      기사명: str(r["기사명"]),
      기사연락처: str(r["기사연락처"]),
    }));

  // ── Sheet5: contacts ──────────────────────────────────────
  const { rows: contactRows, columns: contactCols } = readSheet(wb, "contacts");
  debugInfo.push({ sheet: "contacts", columns: contactCols });
  const contacts = contactRows
    .filter((r) => r["이름"])
    .map((r) => ({
      구분: str(r["구분"]),
      이름: str(r["이름"]),
      연락처: str(r["연락처"]),
      공개여부: (str(r["공개여부"]).toUpperCase() === "Y" ? "Y" : "N") as "Y" | "N",
    }));

  return { students, rooms, schedule, buses, contacts, debugInfo };
}
