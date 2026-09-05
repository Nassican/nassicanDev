import "server-only";

import { db, prismaJson } from "@nassican/db";
import { extractLinks, type ContentBlock, type Locale } from "@nassican/shared";

export type LinkReference = {
  entityType: string;
  entityId: string | null;
  locale: Locale | null;
  label: string;
  href: string | null;
};

export type LinkCheckOutcome =
  | { ok: true; checked: number; broken: number; unverifiable: number }
  | { ok: false; reason: string };

const isExternal = (url: string) => /^https?:\/\//i.test(url);

/**
 * Every outbound address the site exposes, wherever it lives.
 *
 * Bodies are only part of it - the addresses most likely to rot are the ones
 * nobody edits: a diploma's permalink, an old repository, a demo that moved.
 */
async function collect(): Promise<Map<string, LinkReference[]>> {
  const found = new Map<string, LinkReference[]>();

  const add = (url: string, reference: LinkReference) => {
    if (!isExternal(url)) return;
    const clean = url.replace(/[.,;:)]+$/, "");
    found.set(clean, [...(found.get(clean) ?? []), reference]);
  };

  const [posts, projects, certificates, profile, pages] = await Promise.all([
    db.post.findMany({ include: { translations: true } }),
    db.project.findMany({ include: { translations: true } }),
    db.certificate.findMany({ include: { translations: true } }),
    db.profile.findUnique({ where: { id: 1 }, include: { cvs: true } }),
    db.page.findMany({ where: { kind: "custom" }, include: { translations: true } }),
  ]);

  for (const post of posts) {
    for (const t of post.translations) {
      const label = t.title || post.slug;
      for (const url of extractLinks((t.body ?? []) as ContentBlock[])) {
        add(url, {
          entityType: "post",
          entityId: post.id,
          locale: t.locale,
          label,
          href: `/contenido/blogs/${post.id}`,
        });
      }
    }
  }

  for (const project of projects) {
    const href = `/contenido/proyectos/${project.id}`;
    if (project.demoUrl) {
      add(project.demoUrl, {
        entityType: "project",
        entityId: project.id,
        locale: null,
        label: `${project.title} · demo`,
        href,
      });
    }
    if (project.repoUrl) {
      add(project.repoUrl, {
        entityType: "project",
        entityId: project.id,
        locale: null,
        label: `${project.title} · repositorio`,
        href,
      });
    }
    for (const t of project.translations) {
      for (const url of extractLinks((t.body ?? []) as ContentBlock[])) {
        add(url, {
          entityType: "project",
          entityId: project.id,
          locale: t.locale,
          label: `${project.title} · caso de estudio`,
          href,
        });
      }
    }
  }

  for (const certificate of certificates) {
    const title = certificate.translations[0]?.title ?? certificate.provider;
    add(certificate.credentialUrl, {
      entityType: "certificate",
      entityId: certificate.id,
      locale: null,
      label: `${certificate.provider} · ${title}`,
      href: "/perfil",
    });
  }

  const socials = (profile?.socials as { items?: { label: string; href: string }[] } | null)
    ?.items ?? [];
  for (const social of socials) {
    add(social.href, {
      entityType: "profile",
      entityId: null,
      locale: null,
      label: `Red · ${social.label}`,
      href: "/perfil",
    });
  }

  for (const page of pages) {
    for (const t of page.translations) {
      for (const url of extractLinks((t.body ?? []) as ContentBlock[])) {
        add(url, {
          entityType: "page",
          entityId: page.id,
          locale: t.locale,
          label: t.title || page.route,
          href: `/contenido/paginas/${page.id}`,
        });
      }
    }
  }

  return found;
}

/**
 * Statuses that mean "this host refuses automated requests", not "this page is
 * gone". LinkedIn answers 999 to anything that is not a browser; a rate limit
 * says nothing about the target either. Calling these broken would report a
 * working profile as dead, and one false positive is enough to make the whole
 * report ignorable.
 */
const REFUSES_ROBOTS = new Set([429, 999]);

/**
 * A HEAD request first, falling back to GET.
 *
 * Plenty of sites - GitHub and Platzi among them - answer HEAD with 403 or 405
 * while serving the page perfectly well, so treating a failed HEAD as a dead
 * link would report false positives on exactly the addresses that matter here.
 *
 * `ok: null` is the third answer: checked, and the host would not say.
 */
async function probe(
  url: string,
): Promise<{ status: number | null; ok: boolean | null; error: string | null }> {
  const attempt = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // Some hosts refuse requests without a browser-shaped user agent.
          "User-Agent":
            "Mozilla/5.0 (compatible; NassicanLinkCheck/1.0; +https://www.nassican.com)",
        },
        cache: "no-store",
      });
      return { status: response.status, ok: response.ok, error: null };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const head = await attempt("HEAD");
    if (head.ok) return head;

    const get = await attempt("GET");
    if (get.ok) return get;

    if (get.status !== null && REFUSES_ROBOTS.has(get.status)) {
      return {
        status: get.status,
        ok: null,
        error: "el sitio rechaza peticiones automáticas; compruébalo a mano",
      };
    }

    return get;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "sin respuesta en 12 s"
          : error.message
        : "fallo de red";
    return { status: null, ok: false, error: message };
  }
}

/**
 * Rescans where every outbound URL appears, then checks each one once.
 *
 * URLs that no longer appear anywhere are deleted rather than kept as ghosts:
 * the table answers "what does the site link to", not "what has it ever linked
 * to".
 */
export async function checkOutboundLinks(): Promise<LinkCheckOutcome> {
  const run = await db.syncRun.create({
    data: { source: "link_check", status: "running" },
  });

  try {
    const found = await collect();
    const urls = [...found.keys()];

    await db.outboundLink.deleteMany({ where: { url: { notIn: urls } } });

    let broken = 0;
    let unverifiable = 0;

    // Sequential on purpose: a handful of links, and hammering a host in
    // parallel is how a checker gets rate-limited into false positives.
    for (const url of urls) {
      const result = await probe(url);
      if (result.ok === false) broken += 1;
      if (result.ok === null) unverifiable += 1;

      const data = {
        status: result.status,
        ok: result.ok,
        error: result.error,
        checkedAt: new Date(),
        references: prismaJson.record({ items: found.get(url) ?? [] }),
      };

      await db.outboundLink.upsert({
        where: { url },
        update: data,
        create: { url, ...data },
      });
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "ok", rowsWritten: urls.length, finishedAt: new Date() },
    });

    return { ok: true, checked: urls.length, broken, unverifiable };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "fallo al revisar los enlaces";
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason, finishedAt: new Date() },
    });
    return { ok: false, reason };
  }
}
