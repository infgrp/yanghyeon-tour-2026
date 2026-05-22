"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PackageSearch, Plus, CheckCircle2, Package, ChevronLeft,
  Trash2, X, MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeLostItems, createLostItem, updateLostItemStatus, deleteLostItem,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LostItem, LostItemStatus } from "@/types";

const STATUS_LABEL: Record<LostItemStatus, string> = {
  lost: "분실",
  found: "습득",
  returned: "반환완료",
};

const STATUS_COLOR: Record<LostItemStatus, string> = {
  lost: "bg-red-100 text-red-700",
  found: "bg-yellow-100 text-yellow-700",
  returned: "bg-green-100 text-green-700",
};

function formatTime(ts: { toDate: () => Date } | undefined) {
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ── 등록 폼 ──────────────────────────────────────────────────
function NewItemForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; location: string; status: LostItemStatus }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<LostItemStatus>("lost");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("제목을 입력해주세요."); return; }
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), location: location.trim(), status });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-900">분실물 등록</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">분류</label>
            <div className="flex gap-2">
              {(["lost", "found"] as LostItemStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    status === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {s === "lost" ? "분실물 신고" : "습득물 신고"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">물품명 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 검정 지갑, 에어팟 케이스"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">특징 / 설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="색상, 특징 등을 적어주세요"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">위치 / 발견 장소</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 3호차 좌석, 숙소 로비"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? "등록 중..." : "등록하기"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────
export default function LostItemsPage() {
  const { user, appUser, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LostItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<LostItemStatus | "all">("all");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    return subscribeLostItems(setItems);
  }, [user]);

  async function handleCreate(data: {
    title: string; description: string; location: string; status: LostItemStatus;
  }) {
    if (!appUser) return;
    await createLostItem({
      ...data,
      reportedBy: appUser.uid,
      reporterName: appUser.이름 ?? appUser.email ?? "익명",
    });
    toast.success("등록되었습니다.");
  }

  async function handleStatus(item: LostItem, next: LostItemStatus) {
    await updateLostItemStatus(item.id, next, appUser?.uid);
    toast.success("상태가 변경되었습니다.");
  }

  async function handleDelete(item: LostItem) {
    if (!confirm(`"${item.title}"을(를) 삭제하시겠습니까?`)) return;
    await deleteLostItem(item.id);
    toast.success("삭제되었습니다.");
  }

  const isStaff = appUser?.role === "teacher" || appUser?.role === "admin";

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const counts = {
    all: items.length,
    lost: items.filter((i) => i.status === "lost").length,
    found: items.filter((i) => i.status === "found").length,
    returned: items.filter((i) => i.status === "returned").length,
  };

  if (loading || !user) return null;

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <PackageSearch className="w-5 h-5 text-blue-600" />
            <h1 className="font-bold text-gray-900">분실물 게시판</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />등록
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(["all", "lost", "found", "returned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
              }`}
            >
              {f === "all" ? "전체" : STATUS_LABEL[f]}
              <span className={`ml-1.5 text-xs ${filter === f ? "text-blue-100" : "text-gray-400"}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">등록된 분실물이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const canDelete = isStaff || item.reportedBy === appUser?.uid;
              return (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{item.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-600 mb-1">{item.description}</p>
                      )}
                      {item.location && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {item.reporterName} · {formatTime(item.timestamp)}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Status actions (staff only) */}
                  {isStaff && item.status !== "returned" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      {item.status === "lost" && (
                        <button
                          onClick={() => handleStatus(item, "found")}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 py-1.5 rounded-lg transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" />습득 처리
                        </button>
                      )}
                      <button
                        onClick={() => handleStatus(item, "returned")}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 py-1.5 rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />반환 완료
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <NewItemForm onClose={() => setShowForm(false)} onSubmit={handleCreate} />
      )}
    </main>
  );
}
