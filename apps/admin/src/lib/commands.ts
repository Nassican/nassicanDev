import "server-only";

import { db } from "@nassican/db";
import type { Command } from "@/components/CommandPalette";

/**
 * Everything the palette can jump to besides the modules themselves.
 *
 * Read once when the shell renders, not on every keystroke: the collections are
 * small and curated by one person, and a round trip per letter would make the
 * palette slower than the menu it replaces. If the content ever outgrows that,
 * this is the function that changes — nothing in the component.
 */
export async function listCommands(): Promise<Command[]> {
  const [posts, projects, pages, games, books, subscriptions, tasks] = await Promise.all([
    db.post.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, translations: { select: { title: true } } },
    }),
    db.project.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, title: true },
    }),
    db.page.findMany({
      take: 50,
      orderBy: { route: "asc" },
      select: { id: true, route: true, translations: { select: { title: true } } },
    }),
    db.game.findMany({ take: 100, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.book.findMany({ take: 100, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.subscription.findMany({ take: 100, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.task.findMany({ where: { status: { in: ["inbox", "planned"] } }, take: 100, select: { id: true, title: true } }),
  ]);

  return [
    ...posts.map((post) => ({
      id: `post:${post.id}`,
      // Falls back to the slug: a new draft has no title yet, and it is exactly
      // the thing you most want to jump back to.
      label: post.translations.find((t) => t.title.trim())?.title ?? post.slug,
      kind: "Artículo",
      href: `/contenido/blogs/${post.id}`,
    })),
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      label: project.title || project.slug,
      kind: "Proyecto",
      href: `/contenido/proyectos/${project.id}`,
    })),
    ...pages.map((page) => ({
      id: `page:${page.id}`,
      label: page.translations.find((t) => t.title.trim())?.title ?? page.route,
      kind: "Página",
      href: `/contenido/paginas/${page.id}`,
    })),
    /*
     * Games all point at the same page: there is no per-game route, and the
     * module's own search is right there. What the palette is for here is
     * «¿tengo este juego?» answered without leaving the keyboard.
     */
    ...games.map((game) => ({
      id: `game:${game.id}`,
      label: game.title,
      kind: "Juego",
      href: "/juegos",
    })),
    ...books.map((book) => ({
      id: `book:${book.id}`,
      label: book.title,
      kind: "Libro",
      href: "/libros",
    })),
    ...subscriptions.map((sub) => ({
      id: `subscription:${sub.id}`,
      label: sub.name,
      kind: "Suscripción",
      href: "/suscripciones",
    })),
    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      label: task.title,
      kind: "Pendiente",
      href: "/pendientes",
    })),
  ];
}
