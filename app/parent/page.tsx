"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, Search, Bus, Home } from "lucide-react";

interface SessionStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  checkedIn: boolean;
  method?: string;
  checkinAt?: string;
}

interface ParentResult {
  found: boolean;
  이름?: string;
  학년?: number;
  반?: number;
  번호?: number;
  sessions?: SessionStatus[];
}

function methodLabel(method?: string) {
  if (!method) return "";
  if (method === "SELF_TAP") return "직접 확인";
  if (method === "QR_BUS") return "QR 탑승";
  if (method === "TEACHER_TAP") return "교사 확인";
  return method;
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function ParentPage() {
  const [학년, set학년] = useState("");
  const [반, set반] = useState("");
  const [번호, set번호] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParentResult | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!학년 || !반 || !번호) {
      setError("학년, 반, 번호를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/parent/checkin-status?학년=${학년}&반=${반}&번호=${번호}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "조회 중 오류가 발생했습니다.");
        return;
      }
      setResult(data as ParentResult);
      if (!data.found) setError("해당 학생을 찾을 수 없습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const sessions = result?.sessions ?? [];
  const todayCheckedCount = sessions.filter((s) => s.checkedIn).length;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow">
              <Home className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">학부모 점호 조회</h1>
          <p className="text-sm text-gray-500 mt-1">자녀의 수학여행 점호 현황을 확인하세요</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "학년", value: 학년, set: set학년, max: 3 },
              { label: "반", value: 반, set: set반, max: 20 },
              { label: "번호", value: 번호, set: set번호, max: 40 },
            ].map(({ label, value, set, max }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  min={1}
                  max={max}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="–"
                  className="w-full border rounded-lg px-3 py-2 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-3 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Search className="w-4 h-4" />
            {loading ? "조회 중..." : "조회하기"}
          </button>
        </form>

        {/* Result */}
        {result?.found && (
          <div className="bg-white rounded-2xl shadow p-6">
            {/* Student info */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-lg font-bold text-gray-900">{result.이름}</p>
                <p className="text-sm text-gray-500">
                  {result.학년}학년 {result.반}반 {result.번호}번
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{todayCheckedCount}</p>
                <p className="text-xs text-gray-400">/ {sessions.length} 점호 완료</p>
              </div>
            </div>

            <hr className="mb-4" />

            {sessions.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">오늘 점호 일정이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-4 ${
                      s.checkedIn
                        ? "border-green-200 bg-green-50"
                        : s.status === "open"
                          ? "border-yellow-200 bg-yellow-50"
                          : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {s.checkedIn ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : s.status === "open" ? (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm">{s.name}</span>
                          {s.type === "승차점호" && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              <Bus className="w-3 h-3" />버스
                            </span>
                          )}
                          {s.status === "open" && !s.checkedIn && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                              진행중
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatTime(s.startAt)} – {formatTime(s.endAt)}
                        </p>
                        {s.checkedIn && (
                          <p className="text-xs text-green-700 mt-1">
                            {formatTime(s.checkinAt)} 확인 · {methodLabel(s.method)}
                          </p>
                        )}
                        {!s.checkedIn && s.status === "closed" && (
                          <p className="text-xs text-red-500 mt-1">미참여</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              최근 기준이며, 실시간 반영에 약간의 지연이 있을 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
