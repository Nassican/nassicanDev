"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  anchoredSectionKeys,
  locales,
  localeNames,
  type Locale,
  type NavKind,
  type SiteSettings,
} from "@nassican/shared";
import {
  danglingSectionLinks,
  kindLabels,
  navItemProblem,
  sectionLabels,
  timezones,
  type ConfigDraft,
  type NavArea,
  type NavDraft,
  type NavItemDraft,
  type SectionDraft,
} from "@/lib/site-config-draft";
import type { ActionResult } from "@/app/(panel)/configuracion/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none";
const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

let counter = 0;
const newId = () => `new:${(counter += 1)}`;

function emptyItem(area: NavArea, parentId: string | null = null): NavItemDraft {
  return {
    id: newId(),
    area,
    parentId,
    kind: parentId === null && area === "footer" ? "section" : "route",
    target: "",
    position: 0,
    isVisible: true,
    labels: Object.fromEntries(locales.map((l) => [l, ""])) as Record<Locale, string>,
  };
}

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {note ? (
            <p className="mt-0.5 max-w-prose text-xs text-neutral-600">{note}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Move({
  onUp,
  onDown,
  onRemove,
  first,
  last,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove?: () => void;
  first: boolean;
  last: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" className={ghost} onClick={onUp} disabled={first} aria-label="Subir">
        ↑
      </button>
      <button type="button" className={ghost} onClick={onDown} disabled={last} aria-label="Bajar">
        ↓
      </button>
      {onRemove ? (
        <button
          type="button"
          className="rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:border-red-900 hover:text-red-400"
          onClick={onRemove}
          aria-label="Quitar"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/** One editable link. The column headings reuse it with the target hidden. */
function ItemRow({
  item,
  pages,
  isColumn,
  onChange,
  controls,
}: {
  item: NavItemDraft;
  pages: ConfigDraft["pages"];
  isColumn: boolean;
  onChange: (next: NavItemDraft) => void;
  controls: React.ReactNode;
}) {
  const problem = navItemProblem(item);

  return (
    <li className="flex flex-col gap-2 rounded border border-neutral-900 bg-neutral-950 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          {locales.map((locale) => (
            <label key={locale} className="flex flex-col gap-1">
              <span className={labelStyle}>{localeNames[locale]}</span>
              <input
                className={field}
                value={item.labels[locale]}
                placeholder={locale === "en" ? "Projects" : "Proyectos"}
                onChange={(e) =>
                  onChange({
                    ...item,
                    labels: { ...item.labels, [locale]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
        {controls}
      </div>

      {isColumn ? null : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Tipo</span>
            <select
              className={field}
              value={item.kind}
              onChange={(e) =>
                onChange({ ...item, kind: e.target.value as NavKind, target: "" })
              }
            >
              {(Object.keys(kindLabels) as NavKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabels[kind]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Destino</span>
            {item.kind === "section" ? (
              <select
                className={field}
                value={item.target}
                onChange={(e) => onChange({ ...item, target: e.target.value })}
              >
                <option value="">— elige una sección —</option>
                {anchoredSectionKeys.map((key) => (
                  <option key={key} value={key}>
                    {sectionLabels[key]}
                  </option>
                ))}
              </select>
            ) : item.kind === "page" ? (
              <select
                className={field}
                value={item.target}
                onChange={(e) => onChange({ ...item, target: e.target.value })}
              >
                <option value="">— elige una página —</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.label} · {page.route}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={field}
                value={item.target}
                placeholder={item.kind === "external" ? "https://…" : "/projects"}
                onChange={(e) => onChange({ ...item, target: e.target.value })}
              />
            )}
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={item.isVisible}
            onChange={(e) => onChange({ ...item, isVisible: e.target.checked })}
          />
          Visible
        </label>
        {problem ? (
          <span className="text-[11px] text-amber-400">{problem}</span>
        ) : null}
      </div>
    </li>
  );
}

export default function ConfigModule({
  draft,
  actions,
}: {
  draft: ConfigDraft;
  actions: {
    saveSettings: (settings: SiteSettings) => Promise<ActionResult>;
    saveNavigation: (nav: NavDraft, sections: SectionDraft[]) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(draft.settings);
  const [nav, setNav] = useState(draft.nav);
  const [sections, setSections] = useState(draft.sections);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (call: () => Promise<ActionResult>) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await call();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  };

  const swap = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  };

  const patchHeader = (index: number, item: NavItemDraft) =>
    setNav((n) => ({ ...n, header: n.header.map((x, i) => (i === index ? item : x)) }));

  const dangling = danglingSectionLinks(nav, sections);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Navegación, orden de las secciones de la portada y parámetros globales.
        </p>
      </header>

      {settings.maintenanceMode ? (
        <p
          role="status"
          className="rounded border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-300"
        >
          <strong className="font-semibold">El sitio está en mantenimiento.</strong>{" "}
          nassican.com muestra solo el aviso, y no se indexa mientras siga así.
        </p>
      ) : null}

      {result ? (
        <p
          role="status"
          className={`rounded border px-4 py-3 text-sm ${
            result.ok
              ? "border-green-900/60 bg-green-950/30 text-green-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {/* ------------------------- Parámetros globales ----------------------- */}
      <Section
        title="Parámetros globales"
        note="Cada uno decide algo que el sitio hace de verdad. El correo de contacto no está aquí: de eso se encarga el perfil."
        action={
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run(() => actions.saveSettings(settings))}
          >
            {pending ? "Guardando…" : "Guardar ajustes"}
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Línea de marca (pie)</span>
            <input
              className={field}
              value={settings.brandLine}
              onChange={(e) => setSettings({ ...settings, brandLine: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Nombre del copyright</span>
            <input
              className={field}
              value={settings.copyrightName}
              onChange={(e) =>
                setSettings({ ...settings, copyrightName: e.target.value })
              }
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Tema por defecto</span>
            <select
              className={field}
              value={settings.defaultTheme}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultTheme: e.target.value === "light" ? "light" : "dark",
                })
              }
            >
              <option value="dark">Oscuro</option>
              <option value="light">Claro</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Zona horaria</span>
            <select
              className={field}
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Artículos en la portada</span>
            <input
              className={field}
              type="number"
              min={0}
              max={12}
              value={settings.latestPostsCount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  latestPostsCount: Number(e.target.value),
                })
              }
            />
          </label>
        </div>

        <p className="text-[11px] text-neutral-600">
          El tema por defecto solo decide lo que ve quien nunca ha tocado el
          interruptor; a quien ya eligió le manda su cookie. La zona horaria
          decide a qué día pertenece cada instantánea de Estadísticas — los
          informes de Google usan la de su propia propiedad.
        </p>

        <div className="flex flex-col gap-2 border-t border-neutral-900 pt-4">
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={settings.showSectionNavigator}
              onChange={(e) =>
                setSettings({ ...settings, showSectionNavigator: e.target.checked })
              }
            />
            Mostrar las flechas de navegación entre secciones
          </label>

          <label className="flex items-start gap-2 text-sm text-red-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.maintenanceMode}
              onChange={(e) =>
                setSettings({ ...settings, maintenanceMode: e.target.checked })
              }
            />
            <span>
              Modo mantenimiento
              <span className="block text-[11px] text-neutral-500">
                Sustituye el sitio entero por un aviso y lo saca del índice. Al
                apagarlo, el contenido puede tardar hasta cinco minutos en
                volver si falla el aviso de caché.
              </span>
            </span>
          </label>
        </div>
      </Section>

      {/* --------------------------- Navegación ------------------------------ */}
      <Section
        title="Navegación"
        note="Los textos son obligatorios en los dos idiomas: una entrada que existe en español y no en inglés es un hueco por el que se cae el visitante."
        action={
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run(() => actions.saveNavigation(nav, sections))}
          >
            {pending ? "Guardando…" : "Guardar navegación"}
          </button>
        }
      >
        {dangling.length > 0 ? (
          <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
            {dangling
              .map(
                (d) =>
                  `«${sectionLabels[d.section]}» está oculta y ${d.labels
                    .map((l) => `«${l}»`)
                    .join(", ")} sigue apuntando ahí.`,
              )
              .join(" ")}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className={labelStyle}>Cabecera</h3>
          <ul className="flex flex-col gap-2">
            {nav.header.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                pages={draft.pages}
                isColumn={false}
                onChange={(next) => patchHeader(index, next)}
                controls={
                  <Move
                    first={index === 0}
                    last={index === nav.header.length - 1}
                    onUp={() =>
                      setNav((n) => ({ ...n, header: swap(n.header, index, index - 1) }))
                    }
                    onDown={() =>
                      setNav((n) => ({ ...n, header: swap(n.header, index, index + 1) }))
                    }
                    onRemove={() =>
                      setNav((n) => ({
                        ...n,
                        header: n.header.filter((_, i) => i !== index),
                      }))
                    }
                  />
                }
              />
            ))}
          </ul>
          <button
            type="button"
            className={ghost}
            onClick={() =>
              setNav((n) => ({ ...n, header: [...n.header, emptyItem("header")] }))
            }
          >
            + Añadir enlace a la cabecera
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-900 pt-4">
          <h3 className={labelStyle}>Botón de contacto</h3>
          {nav.cta ? (
            <ul>
              <ItemRow
                item={nav.cta}
                pages={draft.pages}
                isColumn={false}
                onChange={(next) => setNav((n) => ({ ...n, cta: next }))}
                controls={
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => setNav((n) => ({ ...n, cta: null }))}
                  >
                    Quitar
                  </button>
                }
              />
            </ul>
          ) : (
            <button
              type="button"
              className={ghost}
              onClick={() => setNav((n) => ({ ...n, cta: emptyItem("header_cta") }))}
            >
              + Añadir el botón
            </button>
          )}
          <p className="text-[11px] text-neutral-600">
            Es el único botón destacado de la cabecera, así que hay uno o
            ninguno.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-900 pt-4">
          <h3 className={labelStyle}>Pie · columnas</h3>
          {nav.footer.map((group, gi) => (
            <div key={group.column.id} className="flex flex-col gap-2 rounded border border-neutral-900 p-3">
              <ItemRow
                item={group.column}
                pages={draft.pages}
                isColumn
                onChange={(next) =>
                  setNav((n) => ({
                    ...n,
                    footer: n.footer.map((g, i) =>
                      i === gi ? { ...g, column: next } : g,
                    ),
                  }))
                }
                controls={
                  <Move
                    first={gi === 0}
                    last={gi === nav.footer.length - 1}
                    onUp={() => setNav((n) => ({ ...n, footer: swap(n.footer, gi, gi - 1) }))}
                    onDown={() => setNav((n) => ({ ...n, footer: swap(n.footer, gi, gi + 1) }))}
                    onRemove={() =>
                      setNav((n) => ({ ...n, footer: n.footer.filter((_, i) => i !== gi) }))
                    }
                  />
                }
              />

              <ul className="ml-4 flex flex-col gap-2 border-l border-neutral-900 pl-4">
                {group.items.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    pages={draft.pages}
                    isColumn={false}
                    onChange={(next) =>
                      setNav((n) => ({
                        ...n,
                        footer: n.footer.map((g, i) =>
                          i === gi
                            ? { ...g, items: g.items.map((x, j) => (j === index ? next : x)) }
                            : g,
                        ),
                      }))
                    }
                    controls={
                      <Move
                        first={index === 0}
                        last={index === group.items.length - 1}
                        onUp={() =>
                          setNav((n) => ({
                            ...n,
                            footer: n.footer.map((g, i) =>
                              i === gi ? { ...g, items: swap(g.items, index, index - 1) } : g,
                            ),
                          }))
                        }
                        onDown={() =>
                          setNav((n) => ({
                            ...n,
                            footer: n.footer.map((g, i) =>
                              i === gi ? { ...g, items: swap(g.items, index, index + 1) } : g,
                            ),
                          }))
                        }
                        onRemove={() =>
                          setNav((n) => ({
                            ...n,
                            footer: n.footer.map((g, i) =>
                              i === gi
                                ? { ...g, items: g.items.filter((_, j) => j !== index) }
                                : g,
                            ),
                          }))
                        }
                      />
                    }
                  />
                ))}
              </ul>

              <button
                type="button"
                className={`${ghost} self-start`}
                onClick={() =>
                  setNav((n) => ({
                    ...n,
                    footer: n.footer.map((g, i) =>
                      i === gi
                        ? { ...g, items: [...g.items, emptyItem("footer", g.column.id)] }
                        : g,
                    ),
                  }))
                }
              >
                + Añadir enlace a esta columna
              </button>
            </div>
          ))}

          <button
            type="button"
            className={`${ghost} self-start`}
            onClick={() =>
              setNav((n) => ({
                ...n,
                footer: [...n.footer, { column: emptyItem("footer"), items: [] }],
              }))
            }
          >
            + Añadir columna
          </button>
          <p className="text-[11px] text-neutral-600">
            Una columna sin enlaces no se dibuja. Los CV no están aquí: son
            descargas con idioma propio y viven junto al nombre, en la primera
            columna del pie.
          </p>
        </div>
      </Section>

      {/* ----------------------- Orden de las secciones ---------------------- */}
      <Section
        title="Secciones de la portada"
        note="El orden y la visibilidad son datos; cada sección sigue siendo un componente con sus propias consultas."
        action={
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run(() => actions.saveNavigation(nav, sections))}
          >
            {pending ? "Guardando…" : "Guardar orden"}
          </button>
        }
      >
        <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
          {sections.map((section, index) => (
            <li
              key={section.key}
              className="flex flex-wrap items-center gap-3 py-2"
            >
              <span className="w-6 text-center font-mono text-[11px] text-neutral-600">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm text-neutral-200">
                {sectionLabels[section.key]}
                <span className="ml-2 font-mono text-[10px] text-neutral-600">
                  {section.key}
                </span>
              </span>
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  checked={section.isVisible}
                  onChange={(e) =>
                    setSections((list) =>
                      list.map((s, i) =>
                        i === index ? { ...s, isVisible: e.target.checked } : s,
                      ),
                    )
                  }
                />
                Visible
              </label>
              <Move
                first={index === 0}
                last={index === sections.length - 1}
                onUp={() => setSections((list) => swap(list, index, index - 1))}
                onDown={() => setSections((list) => swap(list, index, index + 1))}
              />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
