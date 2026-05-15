"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MessageCircle, Users, GraduationCap, Loader2, ChevronRight, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { autoEnsureRoomsForUser, subscribeMyChatRooms, subscribeMyReads } from "@/lib/firestore";
import type { ChatRoom, ChatRoomRead } from "@/types";

function formatTime(ts?: { toDate: () => Date }): string {
  if (!ts) return "";
  const d = ts.toDate();
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function RoomIcon({ type }: { type: ChatRoom["type"] }) {
  if (type === "admin_teachers") {
    return (
      <div className="w-11 h-11 bg-red-50 rounded-full flex items-center justify-center shrink-0">
        <ShieldCheck className="w-5 h-5 text-red-500" />
      </div>
    );
  }
  if (type === "class") {
    return (
      <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
        <Users className="w-5 h-5 text-blue-600" />
      </div>
    );
  }
  return (
    <div className="w-11 h-11 bg-green-50 rounded-full flex items-center justify-center shrink-0">
      <GraduationCap className="w-5 h-5 text-green-600" />
    </div>
  );
}

export default function ChatListPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [reads, setReads] = useState<Record<string, ChatRoomRead>>({});
  const [ensuring, setEnsuring] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
  }, [user, loading, router]);

  // 본인이 속해야 할 방 자동 보장
  useEffect(() => {
    if (!appUser) return;
    autoEnsureRoomsForUser(appUser).finally(() => setEnsuring(false));
  }, [appUser]);

  // 내 방 목록 구독
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMyChatRooms(user.uid, setRooms);
    return unsub;
  }, [user]);

  // 내 읽음 상태 구독 (모든 방의 lastReadAt)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMyReads(user.uid, setReads);
    return unsub;
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const homeRoute = role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button size="sm" variant="ghost" className="text-gray-500 p-1"
            onClick={() => router.push(homeRoute)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-gray-900">채팅</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {ensuring && rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            <p className="text-sm">채팅방을 준비 중입니다...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">받은 공지방이 없습니다.</p>
            {role === "student" && (
              <p className="text-xs mt-2 text-gray-400">
                담임 선생님이 등록되면 반 공지방이 자동으로 생깁니다.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => {
              const myRead = reads[room.id];
              const lastMs = room.lastMessageAt?.toMillis?.() ?? 0;
              const readMs = myRead?.lastReadAt?.toMillis?.() ?? 0;
              const hasUnread = lastMs > 0 && lastMs > readMs;
              return (
                <Link key={room.id} href={`/chat/${room.id}`}>
                  <div className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm transition-all ${
                    hasUnread
                      ? "border-amber-300 hover:border-amber-400 hover:shadow-md"
                      : "border-gray-200 hover:border-blue-400 hover:shadow-md"
                  }`}>
                    <RoomIcon type={room.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`text-sm truncate ${
                            hasUnread ? "font-bold text-gray-900" : "font-semibold text-gray-900"
                          }`}>{room.name}</p>
                          {hasUnread && (
                            <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <span className={`text-xs shrink-0 ${hasUnread ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                          {formatTime(room.lastMessageAt)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${hasUnread ? "text-gray-700" : "text-gray-500"}`}>
                        {room.lastMessage
                          ? <>
                              {room.lastSenderName && (
                                <span className="text-gray-400">{room.lastSenderName}: </span>
                              )}
                              {room.lastMessage}
                            </>
                          : <span className="text-gray-400">아직 메시지가 없습니다.</span>
                        }
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
