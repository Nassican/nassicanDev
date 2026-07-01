"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  const navItems = [
    { id: "about", label: "Sobre mí" },
    { id: "skills", label: "Tecnologías" },
    { id: "experience", label: "Experiencia" },
    { id: "projects", label: "Proyectos" },
  ];

  // Scroll handler for navbar size & transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Section observer to track active menu items
  useEffect(() => {
    const sections = ["about", "skills", "experience", "projects", "contact"];
    const observers = sections.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        {
          rootMargin: "-25% 0px -55% 0px",
          threshold: 0,
        }
      );
      observer.observe(el);
      return { observer, el };
    });

    const handleScrollTop = () => {
      if (window.scrollY < 100) {
        setActiveSection("");
      }
    };
    window.addEventListener("scroll", handleScrollTop);

    return () => {
      window.removeEventListener("scroll", handleScrollTop);
      observers.forEach((obs) => {
        if (obs) obs.observer.unobserve(obs.el);
      });
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "border-b border-black/5 bg-white/80 py-3 shadow-[0_1px_10px_0_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-white/5 dark:bg-black/75 dark:shadow-[0_1px_10px_0_rgba(255,255,255,0.02)]"
            : "border-b border-transparent bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
          {/* Brand Logo & Name */}
          <Link href="#" className="group flex items-center gap-3">
            <div className="relative overflow-hidden rounded-lg">
              <Image
                src="/brand/LogoNassican.png"
                alt="Nassican"
                width={36}
                height={36}
                className="h-9 w-auto transition-all duration-500 ease-out group-hover:scale-110 group-hover:rotate-6"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-zinc-900 transition-colors duration-200 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white">
                Jesús David Benavides Chicaiza
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 transition-colors duration-200 group-hover:text-zinc-500 dark:group-hover:text-zinc-400">
                Portafolio
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`relative rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-300 ${
                    isActive
                      ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                      : "text-zinc-500 hover:bg-black/[0.02] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[0.02] dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href="#contact"
              className={`btn-glass-solid ml-2 text-xs font-semibold tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-95 ${
                activeSection === "contact"
                  ? "ring-2 ring-black/20 dark:ring-white/20"
                  : ""
              }`}
            >
              Contacto
            </a>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            aria-label="Abrir menú"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5 sm:hidden"
            onClick={() => setOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile Drawer Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[80%] max-w-[300px] bg-white/95 dark:bg-black/95 backdrop-blur-xl border-l border-black/10 dark:border-white/10 shadow-2xl transition-transform duration-300 ease-out transform sm:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Navegación
          </span>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5 transition-colors duration-200"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Drawer Body Links */}
        <div className="flex flex-col gap-2.5 p-6">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                onClick={() => setOpen(false)}
                href={`#${item.id}`}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 ${
                  isActive
                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                    : "text-zinc-600 hover:bg-black/[0.02] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[0.02] dark:hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isActive ? "translate-x-1 opacity-100" : "opacity-0"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </a>
            );
          })}

          {/* Contact Button in Drawer */}
          <a
            onClick={() => setOpen(false)}
            href="#contact"
            className={`flex items-center justify-between rounded-xl px-4 py-3 mt-4 text-sm font-bold tracking-wide transition-all duration-200 ${
              activeSection === "contact"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black hover:opacity-90"
            }`}
          >
            <span>Contacto</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Drawer Footer with Socials */}
        <div className="absolute bottom-0 inset-x-0 p-6 border-t border-black/5 dark:border-white/5 flex flex-col gap-4 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <Link
              href="https://github.com/Nassican"
              target="_blank"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 .5A11.5 11.5 0 0 0 .5 12.3c0 5.2 3.3 9.6 7.8 11.1.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.2-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.6 1.2 1.6 1.2 1 .1.7 1.9 2.6 2.5.5-.4.9-.7 1.1-1-2.5-.3-5.2-1.3-5.2-5.8 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.4 1.2a11.6 11.6 0 0 1 6.2 0c2.4-1.5 3.4-1.2 3.4-1.2.6 1.6.2 2.8.1 3.1.8.9 1.2 2 1.2 3.3 0 4.5-2.7 5.5-5.2 5.8.4.3.8.9.8 1.9v2.8c0 .3.2.7.8.6 4.5-1.5 7.8-5.9 7.8-11.1A11.5 11.5 0 0 0 12 .5Z" />
              </svg>
            </Link>
            <a
              href="mailto:contacto@nassican.com"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-11Zm2.2-.5 7.1 5.3c.2.2.6.2.8 0L19.2 6H4.2Zm15.3 2.1-6.6 5a2.5 2.5 0 0 1-3.1 0L3.2 8.1v9.4c0 .6.5 1 1 1h15.6c.5 0 1-.4 1-1V8.1Z" />
              </svg>
            </a>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
            © {new Date().getFullYear()} Nassican. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </>
  );
}

