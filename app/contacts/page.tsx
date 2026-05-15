"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getPublicContacts, getAllContacts } from "@/lib/firestore";
import type { Contact } from "@/types";

export default function ContactsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !role) return;
    const loadContacts = role === "admin" || role === "teacher" ? getAllContacts : getPublicContacts;
    loadContacts()
      .then(setContacts)
      .catch((err) => {
        console.error("contacts load error:", err);
      })
      .finally(() => setDataLoading(false));
  }, [loading, role]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    contacts.forEach((c) => {
      if (!map.has(c.구분)) map.set(c.구분, []);
      map.get(c.구분)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contacts]);

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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button size="sm" variant="ghost" className="text-gray-500 p-1"
            onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-500" />
            <span className="font-bold text-gray-900">비상 연락처</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {grouped.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>등록된 연락처가 없습니다.</p>
          </div>
        ) : (
          grouped.map(([구분, list]) => (
            <div key={구분} className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">{구분}</p>
              {list.map((c) => (
                <div key={c.id}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{c.이름}</p>
                    <p className="text-xs text-gray-400">{c.연락처}</p>
                  </div>
                  <a href={`tel:${c.연락처.replace(/-/g, "")}`}
                    className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg font-medium">
                    <Phone className="w-3.5 h-3.5" /> 전화
                  </a>
                </div>
              ))}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
