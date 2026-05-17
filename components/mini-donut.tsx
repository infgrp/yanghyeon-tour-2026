"use client";

/**
 * 정원·완료 수를 받아 SVG 도넛으로 진행률을 표시하는 작은 컴포넌트.
 * recharts 없이 SVG 만으로 그려 가벼움.
 *
 * 사용:
 *   <MiniDonut completed={20} total={30} />
 */
interface MiniDonutProps {
  completed: number;
  total: number;
  size?: number;     // px
  stroke?: number;   // px
  showText?: boolean;
  color?: string;    // tailwind color or hex
}

export function MiniDonut({
  completed,
  total,
  size = 52,
  stroke = 6,
  showText = true,
  color,
}: MiniDonutProps) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  // 색상: 진행률에 따라 자동 (또는 명시 색)
  const auto =
    pct >= 100 ? "#22c55e"     // 완료 — green
    : pct >= 70 ? "#3b82f6"    // 70%+ — blue
    : pct >= 30 ? "#f59e0b"    // 30%+ — amber
    : "#ef4444";               // 30% 미만 — red
  const fg = color ?? auto;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={stroke}
        />
        {/* progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={fg} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.5s ease-out, stroke 0.3s" }}
        />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold tabular-nums" style={{ color: fg }}>
            {pct}%
          </span>
        </div>
      )}
    </div>
  );
}
