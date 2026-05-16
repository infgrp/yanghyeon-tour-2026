import { cn } from "@/lib/utils";

/**
 * 콘텐츠 placeholder. shimmer 그라데이션 + 둥근 모서리.
 * 사용 예: <Skeleton className="h-8 w-full" />
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-slate-200/70 via-slate-100 to-slate-200/70",
        className
      )}
      {...props}
    />
  );
}

/** 카드 형태 스켈레톤 (헤더 + 본문 라인 3줄) */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-4/5" />
      </div>
    </div>
  );
}

/** 학생 포털용 메인 페이지 스켈레톤 (내 정보 + 바로가기 + 카드들) */
export function StudentPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* 내 정보 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-br from-blue-100 to-indigo-100 px-5 py-4 space-y-2">
          <Skeleton className="h-3 w-20 bg-white/60" />
          <Skeleton className="h-7 w-32 bg-white/60" />
        </div>
        <div className="p-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-1.5">
              <Skeleton className="h-4 w-4 mx-auto rounded-md" />
              <Skeleton className="h-2 w-8 mx-auto" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* 바로가기 */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => <SkeletonCard key={i} />)}
      </div>
      {/* 진행 중 점호 */}
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
