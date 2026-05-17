"use client";

/**
 * 버스 한 대의 좌석 배치를 시각화.
 * 학생 데이터에 별도 좌석번호 필드가 없으므로 학생 번호 순으로 자동 배치.
 *
 * 레이아웃:
 *   ┌──────────────────┐
 *   │   [운전석]       │
 *   ├──────────────────┤
 *   │ [1] [2] | [3] [4]│   row 1
 *   │ [5] [6] | [7] [8]│   row 2
 *   │  ...   |   ...   │
 *   │         |  [back]│
 *   └──────────────────┘
 *
 * 학생 상태:
 *   - 탑승 (체크된 학생): 초록 / CheckCircle 아이콘
 *   - 미탑승: 흰 카드 / 회색
 *   - 클릭: 미탑승이면 onBoard, 탑승이면 onUnboard
 */

import { Bus, CheckCircle2, Heart } from "lucide-react";
import type { Student } from "@/types";
import { MiniDonut } from "./mini-donut";

interface BusSeatGridProps {
  busNumber: number;                              // 호차 번호
  students: Student[];                            // 이 호차 학생들 (sort 무관, 내부에서 번호 순 정렬)
  checkedIds: Set<string>;                        // 탑승 완료 학생 ID 집합
  driverName?: string;                            // 기사명
  guideName?: string;                             // 인솔교사1
  onSeatClick?: (student: Student, isChecked: boolean) => void;
  disabled?: boolean;                             // 점호 만료 등으로 클릭 불가
}

export function BusSeatGrid({
  busNumber, students, checkedIds,
  driverName, guideName, onSeatClick, disabled = false,
}: BusSeatGridProps) {
  const sorted = [...students].sort((a, b) => {
    if (a.학년 !== b.학년) return a.학년 - b.학년;
    if (a.반 !== b.반) return a.반 - b.반;
    return a.번호 - b.번호;
  });

  const total = sorted.length;
  const boarded = sorted.filter((s) => checkedIds.has(s.id)).length;

  // 4열 배치 (좌측 2 + 통로 + 우측 2)
  const rows: Student[][] = [];
  for (let i = 0; i < sorted.length; i += 4) {
    rows.push(sorted.slice(i, i + 4));
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">{busNumber}호차</p>
            <p className="text-[10px] text-blue-100 leading-none mt-0.5">
              {guideName ? `인솔: ${guideName}` : ""}
              {guideName && driverName ? " · " : ""}
              {driverName ? `기사: ${driverName}` : ""}
            </p>
          </div>
        </div>
        <MiniDonut completed={boarded} total={total} size={48} stroke={5} color="#ffffff" />
      </div>

      {/* 운전석 영역 */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">앞</div>
        <div className="px-2.5 py-1 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
          🚗 운전석
        </div>
      </div>

      {/* 좌석 그리드 */}
      <div className="px-3 pb-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">배정된 학생이 없습니다.</p>
        ) : (
          rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-[1fr_1fr_14px_1fr_1fr] gap-1.5 items-stretch">
              {[0, 1].map((i) => {
                const s = row[i];
                if (!s) return <div key={i} />;
                return <Seat key={s.id} student={s} checked={checkedIds.has(s.id)}
                  onClick={onSeatClick} disabled={disabled} />;
              })}
              {/* 통로 */}
              <div className="border-l border-dashed border-slate-300" />
              {[2, 3].map((i) => {
                const s = row[i];
                if (!s) return <div key={i} />;
                return <Seat key={s.id} student={s} checked={checkedIds.has(s.id)}
                  onClick={onSeatClick} disabled={disabled} />;
              })}
            </div>
          ))
        )}
      </div>

      {/* 푸터 — 통계 + 후방 표시 */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 uppercase tracking-wide">뒤</span>
        <span className="text-slate-600">
          <span className="text-green-600 font-bold">{boarded}</span>
          <span className="text-slate-400"> / {total}명 탑승</span>
        </span>
      </div>
    </div>
  );
}

function Seat({
  student, checked, onClick, disabled,
}: {
  student: Student;
  checked: boolean;
  onClick?: (s: Student, isChecked: boolean) => void;
  disabled?: boolean;
}) {
  const handleClick = () => {
    if (disabled || !onClick) return;
    onClick(student, checked);
  };

  const isCaution = student.요양호여부 || !!student.건강요주의사항;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`relative rounded-lg px-1.5 py-1.5 border transition-all text-left ${
        disabled ? "cursor-default" : "active:scale-95 hover:shadow-md"
      } ${
        checked
          ? "bg-gradient-to-br from-green-500 to-emerald-600 border-green-600 text-white shadow-sm shadow-green-200"
          : "bg-white border-slate-300 text-slate-700 hover:border-blue-400"
      }`}
      title={`${student.학년}-${student.반}-${student.번호} ${student.이름}${checked ? " (탑승 완료)" : " (미탑승 — 탭하여 수동 탑승)"}`}
    >
      {/* 좌석 상단 작은 표시 */}
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[9px] font-mono leading-none ${checked ? "text-white/80" : "text-slate-400"}`}>
          {student.학년}-{student.반}-{student.번호}
        </span>
        {checked
          ? <CheckCircle2 className="w-3 h-3 text-white" />
          : isCaution
            ? <Heart className="w-3 h-3 text-amber-500" aria-label="요주의" />
            : <span className="w-3 h-3" />}
      </div>
      <p className={`text-xs font-semibold truncate leading-tight ${checked ? "text-white" : "text-slate-900"}`}>
        {student.이름}
      </p>
    </button>
  );
}
