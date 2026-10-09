import Link from "next/link";

const tabs = [
  { key: "goals", label: "Hábitos y metas", href: "/metas" },
  { key: "wishes", label: "Lista de deseos", href: "/metas/deseos" },
] as const;

/**
 * The two halves of «Metas»: what you want to do, and what you want to have.
 *
 * Links and not state, so each half is its own route — its own address, its own
 * skeleton, and a page that only reads what it shows.
 */
export default function GoalsTabs({ current }: { current: (typeof tabs)[number]["key"] }) {
  return (
    <nav aria-label="Secciones de Metas" className="flex gap-1 border-b border-neutral-900">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-neutral-200 font-medium text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
