"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { signIn, registerStudent, registerTeacher, lookupStudent } from "@/lib/auth";


// ── 공통: 비밀번호 입력 필드 ────────────────────────────────
function PwInput({ value, onChange, placeholder = "비밀번호" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="pr-10 bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── 로그인 탭 ────────────────────────────────────────────────
function LoginForm() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signIn(email, pw);
      const token = await cred.user.getIdTokenResult(true);
      const r = token.claims.role as string | undefined;
      if (r === "admin") router.push("/admin");
      else if (r === "teacher") router.push("/teacher");
      else router.push("/student");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password")) {
        toast.error("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        toast.error("로그인 실패: " + msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">이메일</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="example@school.kr"
          className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" required />
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">비밀번호</Label>
        <PwInput value={pw} onChange={setPw} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        로그인
      </Button>
    </form>
  );
}

// ── 학생 가입 탭 ─────────────────────────────────────────────
function StudentRegisterForm() {
  const [step, setStep] = useState<"lookup" | "confirm" | "register">("lookup");
  const [학년, set학년] = useState("");
  const [반, set반] = useState("");
  const [번호, set번호] = useState("");
  const [foundName, setFoundName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await lookupStudent(Number(학년), Number(반), Number(번호));
      if (!result) { toast.error("해당 학번의 학생을 찾을 수 없습니다."); return; }
      if (result.가입됨) { toast.error("이미 가입된 학번입니다. 본인이 맞다면 관리자에게 문의하세요."); return; }
      setFoundName(result.이름);
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pwConfirm) { toast.error("비밀번호가 일치하지 않습니다."); return; }
    if (pw.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); return; }
    if (!consent) { toast.error("개인정보 수집·이용에 동의해주세요."); return; }
    setBusy(true);
    try {
      const res = await registerStudent({
        학년: Number(학년), 반: Number(반), 번호: Number(번호),
        email, password: pw, privacyConsent: consent,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success(`가입 완료! 환영합니다, ${res.studentName} 학생.`);
      router.push("/student");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email-already-in-use")) toast.error("이미 가입된 이메일입니다.");
      else toast.error("가입 실패: " + msg);
    } finally {
      setBusy(false);
    }
  }

  if (step === "lookup") return (
    <form onSubmit={handleLookup} className="space-y-4">
      <p className="text-sm text-sky-200/70">학년·반·번호를 입력하면 이름을 확인합니다.</p>
      <div className="grid grid-cols-3 gap-2">
        {[["학년", 학년, set학년], ["반", 반, set반], ["번호", 번호, set번호]].map(([label, val, setter]) => (
          <div key={String(label)} className="space-y-1">
            <Label className="text-sky-100 font-medium text-xs">{String(label)}</Label>
            <Input type="number" min={1} value={String(val)}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              className="bg-slate-800 border-slate-600 text-slate-100 text-center" required />
          </div>
        ))}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}학생 조회
      </Button>
    </form>
  );

  if (step === "confirm") return (
    <div className="space-y-4">
      <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-4 text-center">
        <p className="text-sky-200/80 text-sm mb-1">{학년}학년 {반}반 {번호}번</p>
        <p className="text-xl font-bold text-white">{foundName}</p>
        <p className="text-sky-200/80 text-sm mt-1">학생이 맞습니까?</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 border-slate-600 text-slate-300"
          onClick={() => setStep("lookup")}>아니오</Button>
        <Button className="flex-1" onClick={() => setStep("register")}>예, 맞습니다</Button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm text-center">
        <span className="text-sky-200/70">{학년}학년 {반}반 {번호}번 </span>
        <span className="font-bold">{foundName}</span>
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">이메일</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" required />
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">비밀번호 (6자 이상)</Label>
        <PwInput value={pw} onChange={setPw} />
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">비밀번호 확인</Label>
        <PwInput value={pwConfirm} onChange={setPwConfirm} placeholder="비밀번호 확인" />
        {pwConfirm && pw !== pwConfirm && (
          <p className="text-xs text-red-300">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-blue-500" />
        <span className="text-xs text-sky-100/70">
          개인정보 수집·이용 및 Firebase(Google) 서버 저장에 동의합니다.
          수집 항목: 이메일, 학년·반·번호, 이름. 보존 기간: 행사 종료 후 90일.
        </span>
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="border-slate-600 text-slate-300"
          onClick={() => setStep("confirm")}>이전</Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}가입 완료
        </Button>
      </div>
    </form>
  );
}

// ── 교사 가입 탭 ─────────────────────────────────────────────
function TeacherRegisterForm() {
  const [code, setCode]         = useState("");
  const [이름, set이름]         = useState("");
  const [담임학년, set담임학년] = useState("");
  const [담임반, set담임반]     = useState("");
  const [email, setEmail]       = useState("");
  const [pw, setPw]             = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [consent, setConsent]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pwConfirm) { toast.error("비밀번호가 일치하지 않습니다."); return; }
    if (pw.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); return; }
    if (!consent) { toast.error("개인정보 수집·이용에 동의해주세요."); return; }
    setBusy(true);
    try {
      const res = await registerTeacher({
        code, 이름, email, password: pw, privacyConsent: consent,
        담임학년: 담임학년 ? Number(담임학년) : undefined,
        담임반:   담임반   ? Number(담임반)   : undefined,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("교사 가입 완료!");
      router.push("/teacher");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email-already-in-use")) {
        toast.error("이미 가입된 이메일입니다.");
      } else if (msg.includes("permission-denied") || msg.includes("insufficient")) {
        toast.error("Firestore 권한 오류입니다. Firebase Console에서 데이터베이스가 생성되어 있는지 확인해주세요.");
      } else {
        toast.error("가입 실패: " + msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">교사 가입 코드</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="담당 선생님께 받은 코드 입력"
          className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" required />
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">이름</Label>
        <Input value={이름} onChange={(e) => set이름(e.target.value)}
          className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-sky-100 font-medium text-xs">담임 학년 (없으면 비워둠)</Label>
          <Input type="number" min={1} max={3} value={담임학년}
            onChange={(e) => set담임학년(e.target.value)}
            className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" />
        </div>
        <div className="space-y-1">
          <Label className="text-sky-100 font-medium text-xs">담임 반</Label>
          <Input type="number" min={1} value={담임반}
            onChange={(e) => set담임반(e.target.value)}
            className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">이메일</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="bg-white/80 border-sky-200 text-slate-800 placeholder:text-slate-400" required />
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">비밀번호 (6자 이상)</Label>
        <PwInput value={pw} onChange={setPw} />
      </div>
      <div className="space-y-2">
        <Label className="text-sky-100 font-medium">비밀번호 확인</Label>
        <PwInput value={pwConfirm} onChange={setPwConfirm} placeholder="비밀번호 확인" />
        {pwConfirm && pw !== pwConfirm && (
          <p className="text-xs text-red-300">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-blue-500" />
        <span className="text-xs text-sky-100/70">
          개인정보 수집·이용 및 Firebase(Google) 서버 저장에 동의합니다.
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}교사 가입
      </Button>
    </form>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1e3a5f 0%, #1e5f8f 50%, #1a7aa0 100%)",
      }}
    >
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #7dd3fc, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
      </div>

      <div className="w-full max-w-sm space-y-5 relative z-10">
        <Link href="/" className="flex items-center gap-1 text-blue-300/70 text-sm hover:text-blue-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>

        {/* 헤더 */}
        <div className="text-center space-y-1 py-2">
          <div className="flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 145" className="w-44 h-auto drop-shadow-[0_6px_20px_rgba(56,189,248,0.4)]">
              <defs>
                <linearGradient id="g-fuse" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="35%" stopColor="#f8faff" />
                  <stop offset="100%" stopColor="#bae6fd" />
                </linearGradient>
                <linearGradient id="g-wing" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="g-eng" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#bae6fd" />
                  <stop offset="100%" stopColor="#7dd3fc" />
                </linearGradient>
              </defs>
              {/* Horizontal stabilizer */}
              <path d="M 52 84 L 12 100 L 18 92 L 52 88 Z" fill="url(#g-wing)" />
              {/* Vertical tail fin – swept back */}
              <path d="M 55 66 L 42 26 Q 38 22 35 25 L 35 66 Z" fill="url(#g-wing)" />
              {/* Main wing – large swept low-wing */}
              <path d="M 160 78 L 76 122 L 100 122 L 197 85 Z" fill="url(#g-wing)" />
              {/* Winglet */}
              <path d="M 76 122 L 68 108 L 80 120 Z" fill="#3b82f6" />
              {/* Engine pylon */}
              <path d="M 130 85 L 128 116 L 136 116 L 134 85 Z" fill="#93c5fd" opacity="0.65" />
              {/* Engine nacelle */}
              <rect x="106" y="116" width="58" height="13" rx="6.5" fill="url(#g-eng)" stroke="#7dd3fc" strokeWidth="0.6" />
              {/* Engine intake ring */}
              <ellipse cx="113" cy="122" rx="6.5" ry="6.5" fill="#1e4080" opacity="0.2" />
              <ellipse cx="113" cy="122" rx="3.5" ry="3.5" fill="#1e4080" opacity="0.15" />
              {/* Fuselage body */}
              <path d="M 55 66 L 263 66 Q 283 66 292 74 Q 284 83 263 84 L 55 84 Q 40 84 36 78 Q 34 75 36 72 Q 40 67 55 66 Z" fill="url(#g-fuse)" stroke="#93c5fd" strokeWidth="0.7" />
              {/* Blue livery cheatline */}
              <path d="M 55 80 L 263 80 Q 278 80 286 76 Q 284 83 263 84 L 55 84 Q 40 84 36 78 Q 42 82 55 80 Z" fill="#60a5fa" opacity="0.32" />
              {/* Fuselage top highlight */}
              <path d="M 60 66 L 263 67 Q 280 67 288 71 Q 283 67 263 67 L 60 67 Z" fill="white" opacity="0.32" />
              {/* Windows */}
              <g fill="#1e3a5f" opacity="0.22">
                <rect x="100" y="70" width="8" height="7" rx="2" />
                <rect x="116" y="70" width="8" height="7" rx="2" />
                <rect x="132" y="70" width="8" height="7" rx="2" />
                <rect x="148" y="70" width="8" height="7" rx="2" />
                <rect x="164" y="70" width="8" height="7" rx="2" />
                <rect x="180" y="70" width="8" height="7" rx="2" />
                <rect x="196" y="69" width="8" height="7" rx="2" />
                <rect x="212" y="69" width="8" height="7" rx="2" />
                <rect x="228" y="69" width="8" height="7" rx="2" />
                <rect x="244" y="68" width="8" height="7" rx="2" />
                <rect x="258" y="68" width="7" height="7" rx="2" />
              </g>
              {/* Front door outline */}
              <rect x="252" y="67" width="12" height="14" rx="1.5" fill="none" stroke="#60a5fa" strokeWidth="0.7" opacity="0.4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow">양현고 수학여행</h1>
          <p className="text-sky-200/90 text-sm font-medium">2026. 5. 26 (화) ~ 29 (금) · 제주</p>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl overflow-hidden shadow-xl"
          style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          <div className="p-6">
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-5 rounded-xl p-1"
                style={{ background: "rgba(14, 165, 233, 0.15)" }}
              >
                <TabsTrigger value="login"
                  className="flex-1 rounded-lg text-sky-200 data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all font-medium">
                  로그인
                </TabsTrigger>
                <TabsTrigger value="student"
                  className="flex-1 rounded-lg text-sky-200 data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all font-medium">
                  학생 가입
                </TabsTrigger>
                <TabsTrigger value="teacher"
                  className="flex-1 rounded-lg text-sky-200 data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all font-medium">
                  교사 가입
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login"><LoginForm /></TabsContent>
              <TabsContent value="student"><StudentRegisterForm /></TabsContent>
              <TabsContent value="teacher"><TeacherRegisterForm /></TabsContent>
            </Tabs>
          </div>
        </div>

        <p className="text-center text-xs text-sky-700/50 pb-2">
          양현고등학교 · 2026 수학여행 안전 관리 시스템
        </p>
      </div>
    </div>
  );
}
