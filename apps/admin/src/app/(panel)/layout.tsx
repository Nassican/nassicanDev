import Link from "next/link";
import Image from "next/image";
import SignOutButton from "@/components/SignOutButton";
import { navigation, type NavEntry } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

/**
 * A module that is not built yet still appears, greyed out. Showing the whole
 * map from day one makes it obvious what exists and what does not; a menu that
 * hides the unbuilt half does not.
 */
function NavLink({ entry }: { entry: NavEntry }) {
  if (!entry.ready) {
    return (
      <span
        className="block cursor-default rounded px-2 py-1.5 text-sm text-neutral-600"
        title="Pendiente de implementar"
      >
        {entry.label}
      </span>
    );
  }

  return (
    <Link
      href={entry.href}
      className="block rounded px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
    >
      {entry.label}
    </Link>
  );
}

/**
 * Everything inside this route group is behind the session check. `requireUser`
 * runs before any child renders, so a page component never has to ask whether
 * there is a user.
 */
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="border-b border-neutral-900 lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-6 p-5 lg:sticky lg:top-0">
          <Link href="/" className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-600">
              app.nassican.com
            </span>
            <span className="text-sm font-semibold">App Nassican</span>
          </Link>

          <nav>
            <ul className="flex flex-col gap-0.5">
              {navigation.map((entry) => (
                <li key={entry.label}>
                  <NavLink entry={entry} />
                  {entry.children ? (
                    <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-neutral-900 pl-2">
                      {entry.children.map((child) => (
                        <li key={child.href}>
                          <NavLink entry={child} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Pinned rather than scrolled away with the content: it carries who is
            signed in and the way out, and both are answers you want without
            scrolling back up a long list. The opaque background is required -
            the rows underneath would otherwise show through it. */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-neutral-900 bg-[var(--background)] px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
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
          <SignOutButton />
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
