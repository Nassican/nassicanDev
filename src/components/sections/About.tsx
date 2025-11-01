import SectionTitle from "@/components/ui/SectionTitle";

export default function About() {
  return (
    <section id="about" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28">
      <SectionTitle className="mb-4">Sobre mí</SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white/50 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-black/40">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <span>Frontend</span>
          </div>
          <p className="text-zinc-700 dark:text-zinc-300">
            Jesús David Benavides Chicaiza, estudiante de Ingeniería de Sistemas. Me enfoco en crear interfaces limpias, accesibles y de alto rendimiento. Trabajo con React y Next.js para construir experiencias rápidas y escalables, usando componentes reutilizables y un diseño monocromático que comunica modernidad y confianza. Cuido el detalle en UX/UI, estados de carga y transiciones CSS sutiles.
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/50 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-black/40">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <span>Backend</span>
          </div>
          <p className="text-zinc-700 dark:text-zinc-300">
            Diseño APIs robustas y mantenibles, con tipado estricto y validación consistente. Integro bases de datos y servicios externos cuidando la arquitectura, observabilidad y seguridad. Busco un backend predecible y escalable que sirva datos de forma eficiente para apps full‑stack, con foco en claridad, testing y despliegues confiables.
          </p>
        </div>
      </div>
    </section>
  );
}
