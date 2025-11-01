"use client";
import { useMemo, useState } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import type { Certificate } from "@/lib/data";
import { certificates } from "@/lib/data";
import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";

export default function CertificatesPage() {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  const [category, setCategory] = useState("all");

  const providers = useMemo(() => {
    return Array.from(new Set(certificates.map((c) => c.provider))).sort();
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(certificates.map((c) => c.category))).sort();
  }, []);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return certificates.filter((c) => {
      const okProvider = provider === "all" || c.provider === provider;
      const okCategory = category === "all" || c.category === category;
      const okQuery = !ql ||
        c.title.toLowerCase().includes(ql) ||
        c.provider.toLowerCase().includes(ql) ||
        (c.category?.toLowerCase().includes(ql));
      return okProvider && okCategory && okQuery;
    });
  }, [q, provider, category]);

  const clear = () => {
    setQ("");
    setProvider("all");
    setCategory("all");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <div className="mb-6 flex items-end justify-between gap-3">
        <SectionTitle>Certificados</SectionTitle>
        <Link href="/#education" className="rounded-full flex items-center gap-1 border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"><BsArrowLeft className="h-4 w-4" /> Volver a Educación</Link>
      </div>

      <div className="sticky top-16 z-10 -mx-4 mb-6 border-black/5 bg-white/70 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-black/50">
        <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-5">
          <input
            placeholder="Buscar por título, proveedor..."
            className="h-11 rounded-full border border-black/10 bg-transparent px-4 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30 sm:col-span-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="relative">
            <select
              className="h-11 w-full appearance-none rounded-full border border-black/10 bg-transparent px-3 pr-9 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="all">Todos los proveedores</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-600 dark:text-zinc-300">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
            </span>
          </div>
          <div className="relative">
            <select
              className="h-11 w-full appearance-none rounded-full border border-black/10 bg-transparent px-3 pr-9 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-600 dark:text-zinc-300">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
            </span>
          </div>
          <button
            onClick={clear}
            className="h-11 rounded-full border border-black/10 px-3 text-sm text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
          >
            Limpiar
          </button>
        </div>
        <div className="mx-auto mt-2 max-w-5xl text-xs text-zinc-600 dark:text-zinc-400">
          {list.length} resultado{list.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {list.length === 0 && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">No hay certificados que coincidan.</div>
        )}
        {list.map((c: Certificate) => (
          <Card key={c.title + c.provider} className="bg-white dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{c.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">{c.provider}</span>
                  <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">{c.category}</span>
                  {c.date && <span>{c.date}</span>}
                </div>
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                Ver
              </a>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
