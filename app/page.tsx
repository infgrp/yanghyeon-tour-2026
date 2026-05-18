"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, Phone, MapPin, LogIn, Plane, Info } from "lucide-react";
import { getSchedule, getPublicContacts } from "@/lib/firestore";
import type { Schedule, Contact } from "@/types";

const DEPARTURE = new Date("2026-05-26T00:00:00+09:00");
const DAY_LABELS = ["", "1일차 (5/26 화)", "2일차 (5/27 수)", "3일차 (5/28 목)", "4일차 (5/29 금)"];

function Countdown() {
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setDiff(DEPARTURE.getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (diff === null) return null;

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-2 justify-center">
        <Plane className="w-5 h-5 text-sky-600 animate-bounce" />
        <p className="text-xl font-bold text-sky-600">수학여행 중!</p>
      </div>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-2 justify-center">
      {[["일", days], ["시간", hrs], ["분", mins], ["초", secs]].map(([label, val]) => (
        <div key={String(label)} className="flex flex-col items-center">
          <div className="bg-blue-600 text-white rounded-2xl w-16 h-16 flex items-center justify-center shadow-md shadow-blue-200">
            <span className="text-2xl font-bold tabular-nums">{String(val).padStart(2, "0")}</span>
          </div>
          <span className="text-xs text-blue-500 font-medium mt-1.5">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      getSchedule().catch(() => [] as Schedule[]),
      getPublicContacts().catch(() => [] as Contact[]),
    ]).then(([s, c]) => {
      setSchedules(s);
      setContacts(c);
    }).finally(() => setLoading(false));
  }, []);

  const uniqueDays = Array.from(new Set(schedules.map((s) => Number(s.일차)))).sort((a, b) => a - b);
  const byDay = (d: number) => schedules.filter((s) => Number(s.일차) === d);

  const contactGroups: Record<string, Contact[]> = {};
  contacts.forEach((c) => {
    if (!contactGroups[c.구분]) contactGroups[c.구분] = [];
    contactGroups[c.구분].push(c);
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <Plane className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-bold text-gray-900">양현고 수학여행</span>
          </div>
          <Link href="/login" className="inline-flex items-center gap-1 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-md px-2.5 py-1.5 text-[0.8rem] font-medium transition-colors">
            <LogIn className="w-3.5 h-3.5" /> 로그인
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Countdown */}
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-base font-bold text-blue-800">
              2026 수학여행 — 제주 D-DAY
            </CardTitle>
            <p className="text-center text-sm text-blue-400 font-medium">5월 26일(화) ~ 29일(금)</p>
          </CardHeader>
          <CardContent className="flex justify-center pb-7">
            <Countdown />
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              일정표
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-6">불러오는 중…</p>
            ) : schedules.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">일정 데이터가 없습니다.</p>
            ) : (
              <Tabs defaultValue={String(uniqueDays[0] ?? 1)}>
                <TabsList className="w-full bg-gray-100 h-9 mb-4 rounded-xl">
                  {uniqueDays.map((d) => (
                    <TabsTrigger key={d} value={String(d)} className="flex-1 text-xs rounded-lg">
                      {d}일차
                    </TabsTrigger>
                  ))}
                </TabsList>
                {uniqueDays.map((d) => (
                  <TabsContent key={d} value={String(d)} className="mt-0">
                    <p className="text-xs text-gray-400 font-medium mb-3">{DAY_LABELS[d] ?? `${d}일차`}</p>
                    {byDay(d).map((ev) => (
                      <div key={ev.id} className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
                        <div className="text-xs text-gray-400 w-20 shrink-0 pt-0.5 tabular-nums leading-relaxed">
                          {ev.시작시각}
                          {ev.종료시각 && ev.종료시각 !== ev.시작시각 && (
                            <span className="block">~{ev.종료시각}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{ev.일정명}</p>
                          {ev.장소 && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0 text-gray-300" />{ev.장소}
                            </p>
                          )}
                          {ev.비고 && <p className="text-xs text-gray-400 mt-0.5">{ev.비고}</p>}
                        </div>
                        {ev.점호유형 && (
                          <Badge className={`text-xs shrink-0 self-start mt-0.5 ${
                            ev.점호유형 === "승차점호"
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-blue-50 text-blue-700 border-blue-300"
                          }`}>
                            {ev.점호유형 === "정시점호" ? "점호" : "승차"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-green-600" />
              </div>
              비상 연락처
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-6">불러오는 중…</p>
            ) : contacts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">연락처 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-5">
                {Object.entries(contactGroups).map(([group, list], gi) => (
                  <div key={group}>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">{group}</p>
                    <div className="space-y-2">
                      {list.map((c) => (
                        <div key={c.id} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{c.이름}</span>
                          <a
                            href={`tel:${c.연락처.replace(/-/g, "")}`}
                            className="flex items-center gap-1.5 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {c.연락처}
                          </a>
                        </div>
                      ))}
                    </div>
                    {gi < Object.keys(contactGroups).length - 1 && (
                      <Separator className="mt-4 bg-gray-100" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notice */}
        <div className="flex gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl p-3.5">
          <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
          <p>학생·교사 기능(점호, 검색, 관리)은 <Link href="/login" className="text-blue-600 font-medium underline underline-offset-2">로그인</Link> 후 이용 가능합니다. 학생 명단·호실·연락처는 공개하지 않습니다.</p>
        </div>
      </main>
    </div>
  );
}
