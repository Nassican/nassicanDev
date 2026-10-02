import type { Metadata } from "next";
import Link from "next/link";
import { localeNames } from "@nassican/shared";
import ListFilters from "@/components/ListFilters";
import { filterList, listFiltersFromParams } from "@/lib/list-filters";
import { hasCaseStudy, isLocaleComplete, listProjects } from "@/lib/projects";
import { createProject } from "./actions";

export const metadata: Metadata = { title: "Proyectos" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const filters = listFiltersFromParams(await searchParams);
  const all = await listProjects();

  const projects = filterList(all, filters, (project) => ({
    title: project.title,
    handle: project.slug,
    status: project.status,
    // `date` is the project's own date, stored as written — "2024" and
    // "2024-08" are both valid, so it is used as the sort key directly.
    date: project.date || null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {all.length} en el portafolio ·{" "}
            {all.filter((p) => p.status === "published").length} publicados
          </p>
        </div>

        <form action={createProject}>
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500"
          >
            Nuevo proyecto
          </button>
        </form>
      </header>

      {all.length > 1 ? (
        <ListFilters
          base="/contenido/proyectos"
          filters={filters}
          statuses={[
            { value: "published", label: "Publicados" },
            { value: "draft", label: "Borradores" },
          ]}
          total={all.length}
          shown={projects.length}
        />
      ) : null}

      {projects.length === 0 && all.length > 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ningún proyecto coincide con el filtro.
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/contenido/proyectos/${project.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-3 transition-colors hover:bg-neutral-900/60"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {project.title}
                <span className="ml-2 text-neutral-600">
                  {project.yearLabel}
                </span>
              </span>

              <span className="flex gap-1.5">
                {project.translations.map((t) => (
                  <span
                    key={t.locale}
                    title={`${localeNames[t.locale]}: ${isLocaleComplete(t) ? "con descripción" : "sin descripción"}`}
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

              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-600">
                {project.stack.length} tecnologías
              </span>

              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                  hasCaseStudy(project)
                    ? "bg-neutral-900 text-neutral-400"
                    : "bg-amber-950 text-amber-400"
                }`}
              >
                {hasCaseStudy(project) ? "con caso" : "sin caso"}
              </span>

              <span
                className={`w-20 shrink-0 rounded px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-[0.1em] ${
                  project.status === "published"
                    ? "bg-green-950 text-green-400"
                    : "bg-neutral-900 text-neutral-500"
                }`}
              >
                {project.status === "published" ? "publicado" : "borrador"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
