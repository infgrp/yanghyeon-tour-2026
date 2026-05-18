"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * 메인 화면에서 사용하는 통일된 액션 카드.
 * 두 가지 variant:
 *   - "primary": 큰 카드 (운영 핵심 액션). 강한 컬러 + 그라데이션.
 *   - "secondary": 작은 카드 (보조 메뉴). 회색 톤.
 *
 * 컬러는 tone 으로 결정 (blue / green / amber / red / indigo / purple).
 */

type Tone = "blue" | "green" | "amber" | "red" | "indigo" | "purple" | "slate";

const TONE_PRIMARY: Record<Tone, { from: string; to: string; ring: string }> = {
  blue:   { from: "from-blue-500",   to: "to-indigo-600",  ring: "ring-blue-200" },
  green:  { from: "from-emerald-500", to: "to-green-600",  ring: "ring-emerald-200" },
  amber:  { from: "from-amber-500",  to: "to-orange-500",  ring: "ring-amber-200" },
  red:    { from: "from-red-500",    to: "to-rose-600",    ring: "ring-red-200" },
  indigo: { from: "from-indigo-500", to: "to-purple-600",  ring: "ring-indigo-200" },
  purple: { from: "from-purple-500", to: "to-pink-500",    ring: "ring-purple-200" },
  slate:  { from: "from-slate-500",  to: "to-slate-600",   ring: "ring-slate-200" },
};

const TONE_SECONDARY: Record<Tone, { iconBg: string; iconFg: string; border: string }> = {
  blue:   { iconBg: "bg-blue-50",    iconFg: "text-blue-600",    border: "hover:border-blue-300" },
  green:  { iconBg: "bg-emerald-50", iconFg: "text-emerald-600", border: "hover:border-emerald-300" },
  amber:  { iconBg: "bg-amber-50",   iconFg: "text-amber-600",   border: "hover:border-amber-300" },
  red:    { iconBg: "bg-red-50",     iconFg: "text-red-500",     border: "hover:border-red-300" },
  indigo: { iconBg: "bg-indigo-50",  iconFg: "text-indigo-600",  border: "hover:border-indigo-300" },
  purple: { iconBg: "bg-purple-50",  iconFg: "text-purple-600",  border: "hover:border-purple-300" },
  slate:  { iconBg: "bg-slate-50",   iconFg: "text-slate-600",   border: "hover:border-slate-300" },
};

interface ActionCardProps {
  icon: LucideIcon;
  label: string;
  desc?: string;
  badge?: string;          // 우측 상단 작은 라벨 (예: "NEW", "3건")
  tone?: Tone;
  variant?: "primary" | "secondary";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionCard({
  icon: Icon, label, desc, badge, tone = "blue",
  variant = "secondary", href, onClick, disabled,
}: ActionCardProps) {
  const content = variant === "primary"
    ? <PrimaryInner icon={Icon} label={label} desc={desc} badge={badge} tone={tone} />
    : <SecondaryInner icon={Icon} label={label} desc={desc} badge={badge} tone={tone} />;

  if (disabled) {
    return <div className="opacity-50 pointer-events-none">{content}</div>;
  }
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

function PrimaryInner({ icon: Icon, label, desc, badge, tone }: {
  icon: LucideIcon; label: string; desc?: string; badge?: string; tone: Tone;
}) {
  const c = TONE_PRIMARY[tone];
  return (
    <div className={`relative bg-gradient-to-br ${c.from} ${c.to} rounded-2xl p-4 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all overflow-hidden`}>
      {badge && (
        <span className="absolute top-2 right-2 bg-white/30 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-sm leading-tight">{label}</p>
          {desc && <p className="text-[11px] text-white/80 mt-0.5 truncate">{desc}</p>}
        </div>
        <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
      </div>
    </div>
  );
}

function SecondaryInner({ icon: Icon, label, desc, badge, tone }: {
  icon: LucideIcon; label: string; desc?: string; badge?: string; tone: Tone;
}) {
  const c = TONE_SECONDARY[tone];
  return (
    <div className={`relative bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all ${c.border}`}>
      {badge && (
        <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5 py-1">
        <div className={`w-9 h-9 ${c.iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 ${c.iconFg}`} />
        </div>
        <p className="font-medium text-xs text-gray-900 text-center leading-tight">{label}</p>
        {desc && <p className="text-[10px] text-gray-400 text-center leading-tight">{desc}</p>}
      </div>
    </div>
  );
}

/** 카테고리 헤더 — 화면 내 그룹 구분 */
export function SectionHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-2 mt-1 px-0.5">
      <div>
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{title}</p>
        {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
