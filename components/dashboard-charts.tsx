"use client";

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Student } from "@/types";

const PIE_COLORS = ["#3b82f6", "#e5e7eb"]; // 가입 / 미가입
const BAR_COLORS = ["#60a5fa", "#a78bfa", "#34d399"]; // 학년 1, 2, 3

interface Props {
  students: Student[];
}

/**
 * 가입률 도넛 차트 + 학년별 가입자/전체 막대 차트.
 * 단일 컴포넌트로 묶어 admin 대시보드 상단에 배치.
 */
export function EnrollmentCharts({ students }: Props) {
  const total = students.length;
  const joined = students.filter((s) => s.uid).length;
  const pct = total > 0 ? Math.round((joined / total) * 100) : 0;

  // 도넛: 가입 / 미가입
  const pieData = [
    { name: "가입", value: joined },
    { name: "미가입", value: total - joined },
  ];

  // 학년별
  const byGrade = new Map<number, { total: number; joined: number }>();
  students.forEach((s) => {
    if (!byGrade.has(s.학년)) byGrade.set(s.학년, { total: 0, joined: 0 });
    const e = byGrade.get(s.학년)!;
    e.total++;
    if (s.uid) e.joined++;
  });
  const barData = Array.from(byGrade.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([학년, v]) => ({
      학년: `${학년}학년`,
      가입: v.joined,
      미가입: v.total - v.joined,
      total: v.total,
    }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* 도넛 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-gray-500 font-medium mb-2">전체 가입률</p>
        <div className="relative h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                cx="50%" cy="50%"
                innerRadius={50}
                outerRadius={70}
                strokeWidth={0}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-3xl font-bold text-blue-600 tabular-nums">{pct}%</p>
            <p className="text-[11px] text-gray-400">{joined}/{total}명</p>
          </div>
        </div>
      </div>

      {/* 막대 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-gray-500 font-medium mb-2">학년별 가입 현황</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="학년" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
              />
              <Bar dataKey="가입" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="미가입" stackId="a" fill="#e5e7eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/**
 * 학년·반별 학생 수 분포 (전체 학생 기준).
 * 더 세부 데이터 시각화가 필요할 때 사용.
 */
export function ClassDistribution({ students }: Props) {
  const map = new Map<string, number>();
  students.forEach((s) => {
    const key = `${s.학년}-${s.반}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  const data = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([key, count], i) => ({
      반: key,
      학생수: count,
      color: BAR_COLORS[Number(key.split("-")[0]) - 1] ?? BAR_COLORS[i % 3],
    }));

  if (data.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-medium mb-2">학년·반별 분포</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="반" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
            <Bar dataKey="학생수" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
