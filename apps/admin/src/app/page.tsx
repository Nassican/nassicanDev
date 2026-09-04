import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "App Nassican",
};

/**
 * Holding page for the first deploy. It exists so the Vercel project and the
 * `app.nassican.com` domain can be wired up and verified before there is any
 * authentication or database access to go wrong.
 */
const modules = [
  { name: "Dashboard", detail: "Resumen de contenido, tráfico y estado" },
  { name: "Contenido", detail: "Blogs, proyectos, páginas y multimedia" },
  { name: "SEO", detail: "Metadatos, redirecciones y Search Console" },
  { name: "Analítica", detail: "Visitas, fuentes y comportamiento" },
  { name: "Estadísticas", detail: "Salud del contenido y cobertura de traducción" },
  { name: "Configuración", detail: "Navegación, secciones y parámetros" },
  { name: "Usuarios", detail: "Acceso, roles y sesiones" },
  { name: "Sistema", detail: "Auditoría, sincronizaciones y despliegues" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">
          app.nassican.com
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">App Nassican</h1>
        <p className="max-w-prose text-neutral-400">
          Plataforma de gestión de{" "}
          <a
            className="text-neutral-200 underline underline-offset-4 hover:text-white"
            href="https://nassican.com"
          >
            nassican.com
          </a>
          . En construcción.
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-neutral-800 border-y border-neutral-800">
        {modules.map((module) => (
          <li
            key={module.name}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
          >
            <span className="w-32 font-medium">{module.name}</span>
            <span className="flex-1 text-sm text-neutral-500">
              {module.detail}
            </span>
          </li>
        ))}
      </ul>

      <p className="font-mono text-xs text-neutral-600">
        Acceso restringido · pendiente de autenticación
      </p>
    </main>
  );
}
