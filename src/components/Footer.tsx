import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-black/10 bg-black text-zinc-200 dark:border-white/10">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-3">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Image src="/brand/LogoNassican.png" width={32} height={32} alt="Nassican" className="h-8 w-auto" />
            <span className="text-sm font-semibold tracking-wide">Jesús David Benavides Chicaiza</span>
          </div>
          <p className="text-sm text-zinc-400">
            Construyendo experiencias web con un enfoque en diseño monocromático, rendimiento y accesibilidad.
          </p>
          <div className="flex items-center gap-3 text-zinc-300">
            <Link aria-label="GitHub" href="https://github.com/Nassican" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/10">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 .5A11.5 11.5 0 0 0 .5 12.3c0 5.2 3.3 9.6 7.8 11.1.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.2-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.6 1.2 1.6 1.2 1 .1.7 1.9 2.6 2.5.5-.4.9-.7 1.1-1-2.5-.3-5.2-1.3-5.2-5.8 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.4 1.2a11.6 11.6 0 0 1 6.2 0c2.4-1.5 3.4-1.2 3.4-1.2.6 1.6.2 2.8.1 3.1.8.9 1.2 2 1.2 3.3 0 4.5-2.7 5.5-5.2 5.8.4.3.8.9.8 1.9v2.8c0 .3.2.7.8.6 4.5-1.5 7.8-5.9 7.8-11.1A11.5 11.5 0 0 0 12 .5Z"/></svg>
            </Link>
            <a aria-label="Email" href="mailto:contacto@nassican.com" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/10">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-11Zm2.2-.5 7.1 5.3c.2.2.6.2.8 0L19.2 6H4.2Zm15.3 2.1-6.6 5a2.5 2.5 0 0 1-3.1 0L3.2 8.1v9.4c0 .6.5 1 1 1h15.6c.5 0 1-.4 1-1V8.1Z"/></svg>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:col-span-2 sm:grid-cols-3">
          <div>
            <div className="mb-3 text-sm font-semibold">Contenido</div>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li><Link href="#skills" className="hover:underline">Tecnologías</Link></li>
              <li><Link href="#projects" className="hover:underline">Proyectos</Link></li>
              <li><Link href="/certificates" className="hover:underline">Certificados</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Servicios</div>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li><Link href="#experience" className="hover:underline">Experiencia</Link></li>
              <li><Link href="#education" className="hover:underline">Educación</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Más</div>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li><Link href="#about" className="hover:underline">Sobre mí</Link></li>
              <li><Link href="#contact" className="hover:underline">Contacto</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-zinc-400">
        © {year} Nassican. Todos los derechos reservados.
      </div>
    </footer>
  );
}
