"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, QrCode, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getOpenSessions, getStudent, createCheckin } from "@/lib/firestore";
import type { CheckinSession, Student } from "@/types";

// html5-qrcode is a browser-only lib, lazy-import to avoid SSR crash
async function startScanner(
  elementId: string,
  onScan: (text: string) => void,
  onError: (err: unknown) => void
) {
  const { Html5Qrcode } = await import("html5-qrcode");
  const qr = new Html5Qrcode(elementId);
  await qr.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (text) => { onScan(text); },
    onError
  );
  return qr;
}

export default function StudentQRPage() {
  const { user, appUser, role, loading } = useAuth();
  const router = useRouter();
  const qrRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (role && role !== "student") { router.replace("/"); return; }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!appUser?.studentRef) return;
    const id = appUser.studentRef.split("/").pop()!;
    getStudent(id).then(setStudent);
  }, [appUser]);

  useEffect(() => {
    return () => {
      qrRef.current?.stop().catch(() => {});
    };
  }, []);

  async function handleScan(text: string) {
    if (processing || done) return;
    if (!text.startsWith("bus=")) {
      toast.error("올바른 버스 QR 코드가 아닙니다.");
      return;
    }
    const busNum = Number(text.replace("bus=", ""));
    if (!student || !user || !appUser) return;

    // 학생 호차 확인
    if (student.호차 !== busNum) {
      toast.error(`${busNum}호차 버스가 아닙니다. 본인 호차(${student.호차}호차)를 확인하세요.`);
      return;
    }

    setProcessing(true);
    try {
      // 승차점호 세션 찾기
      const sessions = await getOpenSessions();
      const busSessions = sessions.filter((s: CheckinSession) => {
        if (s.type !== "승차점호") return false;
        const scope = s.scope;
        if (scope === "전체") return true;
        if (scope === `호차:${busNum}`) return true;
        if (scope === `학급:${student.반}`) return true;
        return false;
      });

      if (busSessions.length === 0) {
        toast.error("진행 중인 승차점호 세션이 없습니다.");
        setProcessing(false);
        return;
      }

      await qrRef.current?.stop().catch(() => {});
      qrRef.current = null;

      for (const session of busSessions) {
        await createCheckin({
          sessionId: session.id,
          studentId: student.id,
          method: "QR_BUS",
          byUid: user.uid,
          busScanned: busNum,
        });
      }

      setDone(true);
      setScanning(false);
      toast.success(`${busNum}호차 승차 확인 완료!`);
    } catch {
      toast.error("점호 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  }

  async function startScan() {
    setScanning(true);
    setDone(false);
    try {
      const qr = await startScanner("qr-reader", handleScan, () => {});
      qrRef.current = qr;
    } catch {
      toast.error("카메라를 시작할 수 없습니다. 카메라 권한을 확인해주세요.");
      setScanning(false);
    }
  }

  async function stopScan() {
    await qrRef.current?.stop().catch(() => {});
    qrRef.current = null;
    setScanning(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/student">
            <Button size="sm" variant="ghost" className="text-slate-400 p-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-bold">승차 QR 스캔</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {student && (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{student.이름}</p>
                  <p className="text-xs text-slate-400">{student.학년}학년 {student.반}반 · 배정 호차: {student.호차}호차</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-4 h-4 text-blue-400" />
              버스 QR 코드 스캔
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {done ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <CheckCircle2 className="w-16 h-16 text-green-400" />
                <p className="text-xl font-bold text-green-400">승차 확인 완료!</p>
                <p className="text-sm text-slate-400">안전한 여행 되세요.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push("/student")}>
                  돌아가기
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  버스에 부착된 QR 코드를 스캔하면 승차점호가 자동으로 기록됩니다.
                  본인 배정 호차({student?.호차}호차) QR만 인식됩니다.
                </p>

                <div
                  id="qr-reader"
                  className={`w-full rounded-xl overflow-hidden bg-slate-800 ${scanning ? "block" : "hidden"}`}
                  style={{ minHeight: 300 }}
                />

                {processing && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <span className="text-sm">처리 중...</span>
                  </div>
                )}

                {!scanning ? (
                  <Button className="w-full" onClick={startScan}>
                    <QrCode className="w-4 h-4 mr-2" />
                    카메라로 QR 스캔 시작
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" onClick={stopScan}>
                    스캔 중지
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center">
          QR 스캔이 안 될 경우 담당 선생님께 말씀해주세요.
        </p>
      </main>
    </div>
  );
}
