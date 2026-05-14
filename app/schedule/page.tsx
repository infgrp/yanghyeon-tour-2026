"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSchedule } from "@/lib/firestore";
import type { Schedule } from "@/types";

const CHECKIN_BADGE: Record<string, string> = {
  "정시점호": "bg-green-100 text-green-700",
  "승차점호": "bg-blue-100 text-blue-700",
};

function ScheduleItem({ item, expanded }: { item: Schedule; expanded: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-2 shadow-sm transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.시작시각 && (
              <span className="text-xs font-mono text-gray-400">{item.시작시각}</span>
            )}
            {item.점호유형 && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CHECKIN_BADGE[item.점호유형]}`}>
                {item.점호유형}
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 mt-0.5">{item.일정명}</p>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          {item.장소 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {item.장소}
            </div>
          )}
          {item.종료시각 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {item.시작시각 && `${item.시작시각} ~ `}{item.종료시각}
            </div>
          )}
          {item.비고 && (
            <p className="text-xs text-gray-400 pl-1">{item.비고}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);
  const [detailed, setDetailed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
  }, [user, loading, router]);

  useEffect(() => {
    getSchedule().then((s) => { setSchedule(s); setDataLoading(false); });
  }, []);

  const days = useMemo(
    () => Array.from(new Set(schedule.map((s) => s.일차))).sort((a, b) => a - b),
    [schedule]
  );

  useEffect(() => {
    if (days.length > 0 && !days.includes(activeDay)) setActiveDay(days[0]);
  }, [days, activeDay]);

  const dayItems = useMemo(
    () => schedule.filter((s) => s.일차 === activeDay),
    [schedule, activeDay]
  );

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" className="text-gray-500 p-1"
                onClick={() => router.back()}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-gray-900">여행 일정</span>
              </div>
            </div>
            <Button size="sm" variant="outline"
              className="border-gray-300 text-gray-600 text-xs h-8"
              onClick={() => setDetailed(!detailed)}>
              {detailed ? (
                <><ChevronUp className="w-3.5 h-3.5 mr-1" />간략히</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5 mr-1" />자세히</>
              )}
            </Button>
          </div>

          {/* 일차 탭 */}
          <div className="flex gap-1">
            {days.map((d) => (
              <button key={d} onClick={() => setActiveDay(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeDay === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {d}일차
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {dayItems.length === 0 ? (
          <p className="text-center text-gray-400 py-12">일정 정보가 없습니다.</p>
        ) : (
          dayItems.map((item) => (
            <ScheduleItem key={item.id} item={item} expanded={detailed} />
          ))
        )}
      </main>
    </div>
  );
}
