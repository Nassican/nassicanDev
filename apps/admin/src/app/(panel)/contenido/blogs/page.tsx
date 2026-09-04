import type { Metadata } from "next";
import Link from "next/link";
import { localeNames } from "@nassican/shared";
import { incompleteLocales, isLocaleComplete, listPosts } from "@/lib/posts";
import { createPost } from "./actions";

export const metadata: Metadata = { title: "Blogs" };

const statusStyles: Record<string, string> = {
  published: "bg-green-950 text-green-400",
  draft: "bg-neutral-900 text-neutral-500",
  scheduled: "bg-blue-950 text-blue-300",
  archived: "bg-neutral-900 text-neutral-600",
};

const statusLabels: Record<string, string> = {
  published: "publicado",
  draft: "borrador",
  scheduled: "programado",
  archived: "archivado",
};

export default async function BlogsPage() {
  const posts = await listPosts();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Blogs</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {posts.length === 0
              ? "Todavía no hay artículos."
              : `${posts.length} ${posts.length === 1 ? "artículo" : "artículos"}.`}
          </p>
        </div>

        <form action={createPost}>
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500"
          >
            Nuevo artículo
          </button>
        </form>
      </header>

      {posts.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Crea el primero. Mientras no haya ninguno publicado, <code>/blog</code>{" "}
          en el sitio público sigue mostrando su estado «Próximamente».
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
          {posts.map((post) => {
            const missing = incompleteLocales(post);
            const title =
              post.translations.find((t) => t.title.trim())?.title ??
              "Sin título";

            return (
              <li key={post.id}>
                <Link
                  href={`/contenido/blogs/${post.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-3 transition-colors hover:bg-neutral-900/60"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {title}
                  </span>

                  <span className="flex gap-1.5">
                    {post.translations.map((t) => (
                      <span
                        key={t.locale}
                        title={`${localeNames[t.locale]}: ${isLocaleComplete(t) ? "completo" : "incompleto"}`}
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                          isLocaleComplete(t)
                            ? "bg-green-950 text-green-400"
                            : "bg-amber-950 text-amber-400"
                        }`}
                      >
                        {t.locale}
                      </span>
                    ))}
                  </span>

                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${statusStyles[post.status]}`}
                  >
                    {statusLabels[post.status]}
                  </span>

                  <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-600">
                    {post.publishedAt
                      ? post.publishedAt.slice(0, 10)
                      : "sin fecha"}
                  </span>
                </Link>

                {missing.length > 0 && post.status === "published" ? (
                  <p className="px-2 pb-3 text-xs text-amber-500">
                    Publicado pero incompleto en {missing.join(", ")}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
