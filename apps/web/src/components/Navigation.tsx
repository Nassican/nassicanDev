"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { BsEnvelope, BsGithub, BsLinkedin } from "react-icons/bs";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { NavLink, NavTree } from "@nassican/shared";
import type { Profile } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { localePath, stripLocale, type Locale } from "@/lib/i18n/config";
import { isCurrentLink, isExternalLink, navHref } from "@/lib/nav";

export default function Navigation({
  locale,
  t,
  profile,
  nav,
  copyrightName,
}: {
  locale: Locale;
  t: Dictionary;
  /** Passed down rather than imported: this is a client component and the
   *  profile now comes from the database. */
  profile: Profile;
  /** Already resolved for this language, for the same reason. */
  nav: NavTree;
  copyrightName: string;
}) {
  const github = profile.socials.find((social) => social.label === "GitHub");
  const linkedin = profile.socials.find((social) => social.label === "LinkedIn");
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // The sections only exist on the homepage. From any other route a bare
  // "#about" would resolve against the current path and go nowhere, so the
  // links have to carry the homepage in front of the hash.
  const pathname = usePathname();
  const canonicalPath = stripLocale(pathname ?? "/");
  const isHome = canonicalPath === "/";
  const home = localePath(locale, "/");

  const { header: navItems, cta } = nav;

  const hrefFor = (item: NavLink) => navHref(item, locale, isHome);
  const isActive = (item: NavLink) =>
    isCurrentLink(item, canonicalPath, activeSection, isHome);
  const externalProps = (item: NavLink) =>
    isExternalLink(item)
      ? { target: "_blank" as const, rel: "noreferrer" }
      : {};

  // Watch exactly the sections the menu points at. Hard-coding the list meant
  // that hiding or renaming a section left the highlight stuck on an anchor
  // that no longer existed.
  const sectionIds = useMemo(
    () =>
      [...navItems, ...(cta ? [cta] : [])]
        .filter((item) => item.kind === "section")
        .map((item) => item.target),
    [navItems, cta],
  );

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
    const observers = sectionIds.map((id) => {
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
  }, [pathname, sectionIds]);

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
          <Link href={home} className="group flex items-center gap-3">
            {/* The logo art is a black mark on an opaque white square. The
                transform lives on the wrapper, not the image, so the mask
                scales and rotates with it - otherwise the square corners of
                the artwork slide out from under the clip on hover. */}
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-6">
              <Image
                src="/brand/LogoNassican.png"
                alt="Nassican"
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-zinc-900 transition-colors duration-200 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white">
                {profile.name}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 transition-colors duration-200 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
                {t.nav.portfolio}
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.id}
                  href={hrefFor(item)}
                  {...externalProps(item)}
                  aria-label={item.ariaLabel ?? undefined}
                  className={`relative rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-300 ${
                    active
                      ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                      : "text-zinc-500 hover:bg-black/[0.02] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[0.02] dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {cta ? (
              <Link
                href={hrefFor(cta)}
                {...externalProps(cta)}
                aria-label={cta.ariaLabel ?? undefined}
                className={`btn-glass-solid ml-2 text-xs font-semibold tracking-wide transition-all duration-300 hover:scale-[1.03] active:scale-95 ${
                  isActive(cta) ? "ring-2 ring-black/20 dark:ring-white/20" : ""
                }`}
              >
                {cta.label}
              </Link>
            ) : null}
            <LanguageSwitcher
              locale={locale}
              label={t.language.switchTo}
              className="ml-2"
            />
            <ThemeToggle t={t} className="ml-2" />
          </div>

          {/* Mobile Actions: theme toggle + menu */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle t={t} />
            <button
              type="button"
              aria-label={t.nav.openMenu}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
              onClick={() => setOpen(true)}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile Drawer Panel */}
      <div
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        aria-hidden={!open}
        inert={!open}
        className={`fixed top-0 right-0 z-50 h-full w-[80%] max-w-[300px] bg-white/95 dark:bg-black/95 backdrop-blur-xl border-l border-black/10 dark:border-white/10 shadow-2xl transition-transform duration-300 ease-out transform lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/5">
          <span
            id="mobile-navigation-title"
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400"
          >
            {t.nav.navigation}
          </span>
          <button
            type="button"
            aria-label={t.nav.closeMenu}
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5 transition-colors duration-200"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Drawer Body Links */}
        <div className="flex flex-col gap-2.5 p-6">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.id}
                onClick={() => setOpen(false)}
                href={hrefFor(item)}
                {...externalProps(item)}
                aria-label={item.ariaLabel ?? undefined}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 ${
                  active
                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                    : "text-zinc-600 hover:bg-black/[0.02] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[0.02] dark:hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform duration-200 ${
                    active ? "translate-x-1 opacity-100" : "opacity-0"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}

          {/* Contact Button in Drawer */}
          {cta ? (
            <Link
              onClick={() => setOpen(false)}
              href={hrefFor(cta)}
              {...externalProps(cta)}
              aria-label={cta.ariaLabel ?? undefined}
              className={`flex items-center justify-between rounded-xl px-4 py-3 mt-4 text-sm font-bold tracking-wide transition-all duration-200 ${
                isActive(cta)
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black hover:opacity-90"
              }`}
            >
              <span>{cta.label}</span>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ) : null}
        </div>

        {/* Drawer Footer with Socials */}
        <div className="absolute bottom-0 inset-x-0 p-6 border-t border-black/5 dark:border-white/5 flex flex-col gap-4 bg-black/[0.01] dark:bg-white/[0.01]">
          <LanguageSwitcher locale={locale} label={t.language.switchTo} />
          <div className="flex items-center gap-3">
            <a
              aria-label={github?.label ?? "GitHub"}
              href={github?.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all duration-200"
            >
              <BsGithub className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              aria-label={linkedin?.label ?? "LinkedIn"}
              href={linkedin?.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all duration-200"
            >
              <BsLinkedin className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              aria-label={t.contact.email}
              href={`mailto:${profile.email}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all duration-200"
            >
              <BsEnvelope className="h-5 w-5" aria-hidden="true" />
            </a>
            <ThemeToggle t={t} className="!h-10 !w-10" />
          </div>
          <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            © {new Date().getFullYear()} {copyrightName}. {t.footer.rights}
          </p>
        </div>
      </div>
    </>
  );
}
