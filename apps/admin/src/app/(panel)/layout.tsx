import Link from "next/link";
import Image from "next/image";
import SignOutButton from "@/components/SignOutButton";
import { navigation } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

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
                <li key={entry.href}>
                  {entry.ready ? (
                    <Link
                      href={entry.href}
                      className="block rounded px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
                    >
                      {entry.label}
                    </Link>
                  ) : (
                    <span
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-neutral-600"
                      title="Pendiente de implementar"
                    >
                      {entry.label}
                      <span className="font-mono text-[10px] text-neutral-700">
                        ·
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-900 px-6 py-3">
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
