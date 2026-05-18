"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Send, Loader2, ShieldCheck, Users, GraduationCap, Shield, Megaphone, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  getChatRoom, subscribeRoomMessages, sendChatMessage,
  markRoomAsRead, subscribeRoomReads, getStudent,
} from "@/lib/firestore";
import type { ChatRoom, ChatMessage, ChatRoomRead, Student } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function formatTime(ts: { toDate: () => Date }): string {
  const d = ts.toDate();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function dayLabel(d: Date): string {
  const today = new Date();
  if (sameDay(d, today)) return "오늘";
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (sameDay(d, y)) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function RoomTitleIcon({ type }: { type: ChatRoom["type"] }) {
  const cls = "w-4 h-4";
  if (type === "admin_teachers") return <ShieldCheck className={`${cls} text-red-500`} />;
  if (type === "class") return <Users className={`${cls} text-blue-600`} />;
  return <GraduationCap className={`${cls} text-green-600`} />;
}

function roleBadge(role: ChatMessage["senderRole"]) {
  if (role === "admin") return <Shield className="w-3 h-3 text-red-500" aria-label="관리자" />;
  if (role === "teacher") return <GraduationCap className="w-3 h-3 text-blue-600" aria-label="교사" />;
  return null;
}

export default function ChatRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const router = useRouter();
  const { user, appUser, role, loading } = useAuth();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reads, setReads] = useState<ChatRoomRead[]>([]);
  const [readsModalMsg, setReadsModalMsg] = useState<ChatMessage | null>(null);
  const [myStudent, setMyStudent] = useState<Student | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
  }, [user, loading, router]);

  // 방 메타 로드
  useEffect(() => {
    if (!roomId) return;
    getChatRoom(roomId)
      .then((r) => setRoom(r))
      .finally(() => setRoomLoading(false));
  }, [roomId]);

  // 메시지 구독
  useEffect(() => {
    if (!roomId || !user) return;
    const unsub = subscribeRoomMessages(roomId, setMessages);
    return unsub;
  }, [roomId, user]);

  // 같은 방의 모든 사용자 read 상태 구독 (교사·관리자에게는 의미 있음)
  useEffect(() => {
    if (!roomId || !user) return;
    const unsub = subscribeRoomReads(roomId, setReads);
    return unsub;
  }, [roomId, user]);

  // 학생인 경우 학생 메타 정보(학년·반·번호) 로드 — read 문서에 함께 저장
  useEffect(() => {
    if (role !== "student" || !appUser?.studentRef) { setMyStudent(null); return; }
    const sid = appUser.studentRef.split("/").pop()!;
    getStudent(sid).then(setMyStudent).catch(() => setMyStudent(null));
  }, [role, appUser?.studentRef]);

  // 진입 시·새 메시지 수신 시 markRoomAsRead
  useEffect(() => {
    if (!roomId || !user || !appUser || !role) return;
    const profile: Parameters<typeof markRoomAsRead>[0]["reader"] = {
      uid: user.uid,
      name: appUser.이름,
      role,
    };
    if (myStudent) {
      profile.학년 = myStudent.학년;
      profile.반 = myStudent.반;
      profile.번호 = myStudent.번호;
    }
    markRoomAsRead({ roomId, reader: profile }).catch(() => {});
  }, [roomId, user, appUser, role, myStudent, messages.length]);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || !user || !appUser || !role || sending) return;
    setSending(true);
    const body = text;
    setText("");
    try {
      await sendChatMessage({
        roomId,
        text: body,
        sender: {
          uid: user.uid,
          name: appUser.이름 ?? (role === "student" ? "학생" : role === "teacher" ? "선생님" : "관리자"),
          role,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("학생은") || msg.includes("permission-denied")) {
        toast.error("이 방에서는 메시지를 보낼 수 없습니다.");
      } else {
        toast.error("메시지 전송 실패: " + msg);
      }
      setText(body);
    } finally {
      setSending(false);
    }
  }

  if (loading || !user || roomLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-500 text-sm">채팅방을 찾을 수 없습니다.</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => router.push("/chat")}>
          채팅 목록으로
        </Button>
      </div>
    );
  }

  const myUid = user.uid;
  const isMember = room.members.includes(myUid);
  // 학생은 절대 메시지를 보낼 수 없음 (관리자→교사→학생 일방향)
  const canSend = isMember && role !== "student";
  const isStudentReadOnly = role === "student";
  const canSeeReads = role === "teacher" || role === "admin";

  // 학생 수신자 (read 통계 모집단) — admin/teacher 본인은 제외
  const studentReaders = reads.filter((r) => r.role === "student");
  const studentTotal = studentReaders.length;

  // 날짜 그루핑
  const grouped: Array<{ key: string; date: Date; items: ChatMessage[] }> = [];
  for (const m of messages) {
    const d = m.timestamp.toDate();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.items.push(m);
    else grouped.push({ key, date: d, items: [m] });
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button size="sm" variant="ghost" className="text-gray-500 p-1"
            onClick={() => router.push("/chat")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <RoomTitleIcon type={room.type} />
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-none truncate">{room.name}</p>
              <p className="text-[11px] text-gray-400 leading-none mt-1">
                참여자 {room.members.length}명
                {!isMember && " · 읽기 전용"}
                {isMember && isStudentReadOnly && " · 공지 수신"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              아직 메시지가 없습니다. 첫 메시지를 보내보세요.
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex justify-center">
                  <span className="text-[10px] text-gray-400 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full">
                    {dayLabel(group.date)}
                  </span>
                </div>
                {group.items.map((m, idx) => {
                  const mine = m.senderUid === myUid;
                  const prev = group.items[idx - 1];
                  const sameSender = prev && prev.senderUid === m.senderUid
                    && Math.abs(m.timestamp.toMillis() - prev.timestamp.toMillis()) < 60_000;

                  // 학생 중 이 메시지 이후 lastReadAt이 있는 사람 = 읽음
                  let readCount = 0;
                  if (canSeeReads && m.senderRole !== "student") {
                    for (const r of studentReaders) {
                      if (r.lastReadAt && r.lastReadAt.toMillis() >= m.timestamp.toMillis()) {
                        readCount++;
                      }
                    }
                  }
                  const showReads = canSeeReads
                    && m.senderRole !== "student"
                    && studentTotal > 0;

                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {!mine && !sameSender && (
                          <div className="flex items-center gap-1 mb-0.5 px-1">
                            {roleBadge(m.senderRole)}
                            <span className="text-[11px] text-gray-500 font-medium">{m.senderName}</span>
                          </div>
                        )}
                        <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                              mine
                                ? "bg-blue-600 text-white rounded-br-md"
                                : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                            }`}
                          >
                            {m.text}
                          </div>
                          <div className={`flex flex-col ${mine ? "items-end" : "items-start"} shrink-0 mb-1 gap-0.5`}>
                            {showReads && (
                              <button
                                type="button"
                                onClick={() => setReadsModalMsg(m)}
                                className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors ${
                                  readCount === studentTotal
                                    ? "text-green-600 hover:bg-green-50"
                                    : "text-amber-600 hover:bg-amber-50"
                                }`}
                                title="누가 읽었는지 보기"
                              >
                                <Eye className="w-2.5 h-2.5" />
                                {readCount}/{studentTotal}
                              </button>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {formatTime(m.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!readsModalMsg} onOpenChange={(o) => !o && setReadsModalMsg(null)}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              읽음 현황
            </DialogTitle>
          </DialogHeader>
          {readsModalMsg && (() => {
            const sent = readsModalMsg.timestamp.toMillis();
            const read = studentReaders
              .filter((r) => r.lastReadAt && r.lastReadAt.toMillis() >= sent)
              .sort((a, b) =>
                ((a.학년 ?? 0) - (b.학년 ?? 0))
                || ((a.반 ?? 0) - (b.반 ?? 0))
                || ((a.번호 ?? 0) - (b.번호 ?? 0))
              );
            const unread = studentReaders
              .filter((r) => !r.lastReadAt || r.lastReadAt.toMillis() < sent)
              .sort((a, b) =>
                ((a.학년 ?? 0) - (b.학년 ?? 0))
                || ((a.반 ?? 0) - (b.반 ?? 0))
                || ((a.번호 ?? 0) - (b.번호 ?? 0))
              );
            const fmt = (r: ChatRoomRead) => {
              const num = r.학년 != null && r.반 != null && r.번호 != null
                ? `${r.학년}-${r.반}-${r.번호}` : "";
              return { num, name: r.name ?? "(이름 없음)" };
            };
            return (
              <div className="space-y-4 mt-1 max-h-[60vh] overflow-y-auto">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">메시지</p>
                  <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">
                    {readsModalMsg.text}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">
                      읽지 않음
                    </p>
                    <span className="text-xs text-amber-600 font-bold">{unread.length}명</span>
                  </div>
                  {unread.length === 0 ? (
                    <p className="text-xs text-green-600 py-2">모든 학생이 읽었습니다.</p>
                  ) : (
                    <div className="space-y-1">
                      {unread.map((r) => {
                        const { num, name } = fmt(r);
                        return (
                          <div key={r.id}
                            className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                            {num && <span className="text-[11px] font-mono text-gray-500 shrink-0">{num}</span>}
                            <span className="text-sm text-gray-900">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">읽음</p>
                    <span className="text-xs text-green-600 font-bold">{read.length}명</span>
                  </div>
                  {read.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">아직 읽은 학생이 없습니다.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      {read.map((r) => {
                        const { num, name } = fmt(r);
                        return (
                          <div key={r.id}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600">
                            {num && <span className="font-mono text-[10px] text-gray-400 shrink-0">{num}</span>}
                            <span className="truncate">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {isStudentReadOnly ? (
        <div className="sticky bottom-0 bg-amber-50 border-t border-amber-200 shrink-0 safe-bottom">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2.5">
            <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              담임·관리자 선생님의 공지를 받는 방입니다. 답장이 필요하면
              <span className="font-semibold"> 담임 선생님께 직접 말씀</span>드리세요.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend}
          className="sticky bottom-0 bg-white border-t border-gray-200 shrink-0 safe-bottom">
          <div className="max-w-2xl mx-auto px-3 py-2 flex items-center gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={canSend ? "메시지를 입력하세요" : "쓰기 권한이 없습니다"}
              className="flex-1 border-gray-300 bg-gray-50 text-gray-900"
              disabled={!canSend || sending}
              maxLength={500}
            />
            <Button type="submit" size="sm"
              className="shrink-0 h-9 w-9 p-0"
              disabled={!canSend || sending || !text.trim()}>
              {sending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
