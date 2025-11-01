"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Navigation() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="site-nav fixed top-0 left-0 right-0 z-50 border-b border-black/10 bg-white/70 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.02)] dark:border-white/10 dark:bg-black/50 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] supports-backdrop-filter:bg-white/50 supports-backdrop-filter:dark:bg-black/40">
      <div className="site-nav-inner mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:py-5">
        <Link href="#" className="flex items-center gap-4">
          <Image src="/brand/LogoNassican.png" alt="Nassican" width={36} height={36} className="h-9 w-auto" />
          <span className="text-sm font-normal tracking-wide">Jesús David Benavides Chicaiza</span>
        </Link>
        {/* Desktop nav */}
        <div className="hidden items-center gap-2 sm:flex">
          <a href="#skills" className="btn-glass">Tecnologías</a>
          <a href="#experience" className="btn-glass">Experiencia</a>
          <a href="#projects" className="btn-glass">Proyectos</a>
          <a href="#contact" className="btn-glass-solid">Contacto</a>
        </div>
        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Abrir menú"
          className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-zinc-700 hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>
      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden">
          <div className="mx-auto max-w-5xl px-4 pb-4">
            <div className="grid gap-2">
              <a onClick={() => setOpen(false)} href="#projects" className="btn-glass block rounded-lg px-3 py-2 text-sm">Proyectos</a>
              <a onClick={() => setOpen(false)} href="#skills" className="btn-glass block rounded-lg px-3 py-2 text-sm">Habilidades</a>
              <a onClick={() => setOpen(false)} href="#experience" className="btn-glass block rounded-lg px-3 py-2 text-sm">Experiencia</a>
              <a onClick={() => setOpen(false)} href="#contact" className="btn-glass-solid block rounded-lg px-3 py-2 text-sm">Contacto</a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
