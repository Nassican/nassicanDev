"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  BsBarChart,
  BsFileText,
  BsFiles,
  BsHddStack,
  BsImages,
  BsKanban,
  BsList,
  BsPeople,
  BsPersonBadge,
  BsSearch,
  BsSliders,
  BsSpeedometer2,
  BsWallet2,
  BsController,
  BsBook,
  BsChevronDown,
  BsStars,
  BsArchive,
  BsTrash3,
  BsArrowRepeat,
  BsJournalText,
  BsCheck2Square,
  BsBullseye,
  BsCalendarWeek,
  BsGraphUp,
  BsX,
} from "react-icons/bs";
import CommandPalette, { openCommandPalette, type Command } from "@/components/CommandPalette";
import SignOutButton from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";
import {
  activeHref,
  navigation,
  type NavEntry,
  type NavIcon,
  type NavSection,
} from "@/lib/navigation";

const icons: Record<NavIcon, ComponentType<{ className?: string }>> = {
  dashboard: BsSpeedometer2,
  post: BsFileText,
  project: BsKanban,
  page: BsFiles,
  media: BsImages,
  profile: BsPersonBadge,
  analytics: BsGraphUp,
  stats: BsBarChart,
  seo: BsSearch,
  settings: BsSliders,
  users: BsPeople,
  system: BsHddStack,
  finance: BsWallet2,
  game: BsController,
  book: BsBook,
  skills: BsStars,
  backup: BsArchive,
  trash: BsTrash3,
  subscription: BsArrowRepeat,
  journal: BsJournalText,
  task: BsCheck2Square,
  goal: BsBullseye,
  calendar: BsCalendarWeek,
};

type PanelUser = {
  name: string | null;
  email: string;
  image: string | null;
  role: string;
};

function NavLink({
  entry,
  active,
  onNavigate,
}: {
  entry: NavEntry;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = icons[entry.icon];

  if (!entry.ready) {
    return (
      <span
        className="flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-600"
        title="Pendiente de implementar"
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {entry.label}
      </span>
    );
  }

  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? "bg-neutral-900 text-neutral-100"
          : "text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200"
      }`}
    >
      {/* The bar, not just the fill: on a dark panel a slightly lighter row is
          easy to miss, and the eye finds a vertical edge faster than a shade. */}
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-colors ${
          active ? "bg-neutral-100" : "bg-transparent"
        }`}
      />
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          active ? "text-neutral-100" : "text-neutral-600 group-hover:text-neutral-400"
        }`}
        aria-hidden
      />
      {entry.label}
    </Link>
  );
}

function NavTree({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const current = activeHref(pathname);

  /**
   * Which collapsible sections the operator has folded away.
   *
   * Open by default and folded only on purpose, which is the behaviour that
   * cannot surprise anyone: a section that opened itself because you happened to
   * navigate into it would undo a decision you had just made.
   *
   * Kept in state and not in a cookie or `localStorage`. The shell is the
   * layout, so a client navigation never remounts it and the choice survives the
   * whole session; a full reload starts open again, which is the right default
   * anyway. Persisting it would buy very little and cost either a flash of the
   * wrong state before hydration or a cookie read on every request.
   */
  const [folded, setFolded] = useState<Set<string>>(new Set());

  return (
    <nav className="flex flex-col gap-5">
      {navigation.map((section, i) => {
        const key = section.label ?? `group-${i}`;
        const open = !section.collapsible || !folded.has(key);

        return (
          <div key={key} className="flex flex-col gap-1">
            {section.label ? (
              <SectionHeading
                section={section}
                open={open}
                active={section.href ? current === section.href : false}
                onNavigate={onNavigate}
                onToggle={() =>
                  setFolded((previous) => {
                    const next = new Set(previous);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
              />
            ) : null}

            {open ? (
              <ul className="flex flex-col gap-0.5">
                {section.entries.map((entry) => (
                  <li key={entry.href}>
                    <NavLink
                      entry={entry}
                      active={current === entry.href}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * A group's heading, which is three different things depending on the group.
 *
 * Plain text for a group that is only a label; a link when the group has a page
 * of its own; and a button beside it when it folds. The two are kept apart
 * rather than merged into one clickable row, because «ir a Personal» and
 * «esconder Personal» are different intentions and a single target would make
 * one of them an accident.
 */
function SectionHeading({
  section,
  open,
  active,
  onNavigate,
  onToggle,
}: {
  section: NavSection;
  open: boolean;
  active: boolean;
  onNavigate?: () => void;
  onToggle: () => void;
}) {
  const text = (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
        active ? "text-neutral-300" : "text-neutral-600"
      }`}
    >
      {section.label}
    </span>
  );

  return (
    <h2 className="flex items-center gap-1 px-2.5 pb-0.5">
      {section.href ? (
        <Link
          href={section.href}
          onClick={onNavigate}
          className="flex-1 hover:text-neutral-300"
        >
          {text}
        </Link>
      ) : (
        <span className="flex-1">{text}</span>
      )}

      {section.collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? "Plegar" : "Desplegar"} ${section.label}`}
          className="-mr-1 rounded p-0.5 text-neutral-700 transition-colors hover:text-neutral-400"
        >
          <BsChevronDown
            aria-hidden
            className={`h-2.5 w-2.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
      ) : null}
    </h2>
  );
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
      <Image
        src="/icon.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-md"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">App Nassican</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600">
          app.nassican.com
        </span>
      </span>
    </Link>
  );
}

/**
 * The frame every panel page renders inside.
 *
 * A client component because the menu has to know which route is open, and
 * that is the whole point of the redesign: twelve links with no active state
 * told you nothing about where you were.
 *
 * `children` arrives already rendered on the server, so wrapping the layout in
 * a client component does not drag any page into the browser bundle.
 */
export default function PanelShell({
  user,
  loadCommands,
  captureTask,
  children,
}: {
  user: PanelUser;
  /**
   * Fetched by the palette the first time it opens, not resolved here. Resolving
   * it here charged every page in the panel 217 ms for a list most pages never
   * showed.
   */
  loadCommands: () => Promise<Command[]>;
  captureTask: (raw: string) => Promise<{ ok: boolean; message: string }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  /**
   * The drawer remembers *where* it was opened, and is open only while the
   * route has not moved since.
   *
   * Derived rather than synchronised: closing it from an effect that watches
   * the path would render the open drawer once over the new page before
   * closing it, and cascading renders is exactly what the compiler warns
   * about. This way a navigation - including a back button, which no click
   * handler ever sees - closes it with no effect at all.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;
  const setOpen = (next: boolean) => setOpenedAt(next ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <CommandPalette load={loadCommands} capture={captureTask} />

      {/* ----------------------------- escritorio ------------------------- */}
      <aside className="hidden shrink-0 border-r border-neutral-900 lg:block lg:w-60">
        <div className="sticky top-0 flex max-h-dvh flex-col gap-6 overflow-y-auto p-4">
          <Brand />
          <NavTree />
        </div>
      </aside>

      {/* ------------------------------- móvil ---------------------------- */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        /*
          Dimmed, not blurred, and for a sharper reason than in the palette: this
          one *animates*. A `backdrop-filter` has to re-blur the whole viewport
          on every frame of the fade, so the drawer opened with a stutter on
          exactly the device where that matters.
        */
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        id="panel-navigation"
        aria-label="Módulos"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] overflow-y-auto border-r border-neutral-900 bg-[var(--background)] p-4 transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <Brand onNavigate={() => setOpen(false)} />
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
          >
            <BsX className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <NavTree onNavigate={() => setOpen(false)} />
      </aside>

      {/* ------------------------------ contenido -------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-neutral-900 bg-[var(--background)] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={open}
              aria-controls="panel-navigation"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 lg:hidden"
            >
              <BsList className="h-5 w-5" aria-hidden />
            </button>

            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={28}
                height={28}
                className="hidden rounded-full sm:block"
                unoptimized
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm">{user.name ?? user.email}</p>
              <p className="truncate font-mono text-[11px] text-neutral-500">
                {user.email} · {user.role}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/*
              The palette's only door used to be ⌘K, which a phone does not
              have. On a small screen it is also the fastest way around: the
              menu means opening a drawer and scrolling.
            */}
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Buscar (Ctrl K)"
              title="Buscar (Ctrl K)"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-800 px-2.5 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
            >
              <BsSearch className="h-4 w-4" aria-hidden />
              <span className="hidden text-xs md:inline">Buscar</span>
              <kbd className="hidden rounded border border-neutral-800 px-1 font-mono text-[10px] text-neutral-500 lg:inline">
                Ctrl K
              </kbd>
            </button>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
