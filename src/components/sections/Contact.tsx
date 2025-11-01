import SectionTitle from "@/components/ui/SectionTitle";
import Button from "@/components/ui/Button";
import { profile } from "@/lib/data";

export default function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-5xl px-4 py-16">
      <SectionTitle className="mb-6">Contacto</SectionTitle>
      <form
        action="/api/contact"
        method="post"
        className="grid gap-4 sm:grid-cols-2"
      >
        <input
          name="name"
          placeholder="Nombre"
          className="h-11 rounded-xl border border-black/10 bg-transparent px-4 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="h-11 rounded-xl border border-black/10 bg-transparent px-4 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
          required
        />
        <textarea
          name="message"
          placeholder="Mensaje"
          className="min-h-28 rounded-xl border border-black/10 bg-transparent px-4 py-3 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:focus:border-white/30 sm:col-span-2"
          required
        />
        <div className="sm:col-span-2">
          <Button type="submit">Enviar</Button>
        </div>
      </form>
      <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        También puedes escribirme a{" "}
        <a href={`mailto:${profile.email}`} className="underline">
          {profile.email}
        </a>
        .
      </div>
    </section>
  );
}
