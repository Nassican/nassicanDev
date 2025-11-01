import Button from "@/components/ui/Button";

export default function Hero() {
  return (
    <section className="relative mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-6 px-4 pt-24">
      <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs uppercase tracking-wider text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-black/50 dark:text-zinc-300">
        <span>Desarrollador</span>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
        Jesús David Benavides Chicaiza
      </h1>
      <p className="max-w-2xl text-base text-zinc-700 dark:text-zinc-300">
        Estudiante de Ingeniería de Sistemas.
      </p>
      <div className="flex gap-3">
        <a href="#projects">
          <Button>Ver Proyectos</Button>
        </a>
        <a href="#contact">
          <Button variant="outline">Contactar</Button>
        </a>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full bg-linear-to-r from-transparent via-zinc-300/50 to-transparent dark:via-zinc-700/50" />
      <a
        href="#about"
        aria-label="Desplazarse a Sobre mí"
        className="group absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs text-zinc-700 backdrop-blur transition dark:border-white/10 dark:bg-black/50 dark:text-zinc-200 hover:border-zinc-700 dark:hover:border-zinc-200 hover:bg-zinc-700/5 dark:hover:bg-zinc-200/5"
      >
        <span className="mr-2 align-middle">Desplázate</span>
        <svg
          className="inline h-4 w-4 animate-scroll-cue align-middle"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}
