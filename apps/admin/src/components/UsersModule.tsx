"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  activationProblem,
  describeUserAgent,
  roleChangeProblem,
  roleLabels,
  roleNotes,
  roles,
  type Role,
  type UserRow,
  type UsersSummary,
} from "@/lib/user-draft";
import type { ActionResult } from "@/app/(panel)/usuarios/actions";

const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 focus:border-neutral-600 focus:outline-none disabled:opacity-40";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const danger =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:border-red-900 hover:text-red-400 disabled:opacity-40";

const when = (iso: string | null) =>
  iso ? iso.slice(0, 16).replace("T", " ") : "nunca";

/** How long a session has left, in the units a person would say it in. */
function remaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "caducada";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `caduca en ${days} ${days === 1 ? "día" : "días"}`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `caduca en ${hours} h`;
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {note ? (
          <p className="mt-0.5 max-w-prose text-xs text-neutral-600">{note}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function UserCard({
  user,
  users,
  currentUserId,
  canAdminister,
  pending,
  actions,
}: {
  user: UserRow;
  users: UserRow[];
  currentUserId: string;
  canAdminister: boolean;
  pending: boolean;
  actions: {
    setRole: (id: string, role: Role) => void;
    setActive: (id: string, active: boolean) => void;
    revokeSession: (id: string) => void;
    revokeOthers: (id: string) => void;
  };
}) {
  const isSelf = user.id === currentUserId;
  const deactivateProblem = activationProblem(user, false, currentUserId, users);
  const others = user.sessions.filter((s) => !s.isCurrent);

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={36}
              height={36}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-900" />
          )}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="truncate">{user.name ?? user.email}</span>
              {isSelf ? (
                <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                  tú
                </span>
              ) : null}
              {!user.isActive ? (
                <span className="rounded bg-red-950 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
                  sin acceso
                </span>
              ) : null}
            </p>
            <p className="truncate font-mono text-[11px] text-neutral-500">
              {user.email}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-600">
              Último acceso: {when(user.lastLoginAt)}
              {!user.hasAccount ? " · nunca ha entrado" : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelStyle}>Rol</span>
            <select
              className={field}
              value={user.role}
              disabled={!canAdminister || pending}
              onChange={(e) => actions.setRole(user.id, e.target.value as Role)}
            >
              {roles.map((role) => {
                const problem = roleChangeProblem(user, role, currentUserId, users);
                return (
                  <option key={role} value={role} disabled={Boolean(problem)}>
                    {roleLabels[role]}
                  </option>
                );
              })}
            </select>
          </label>

          <button
            type="button"
            className={user.isActive ? danger : ghost}
            disabled={!canAdminister || pending || Boolean(user.isActive && deactivateProblem)}
            title={user.isActive ? (deactivateProblem ?? undefined) : undefined}
            onClick={() => actions.setActive(user.id, !user.isActive)}
          >
            {user.isActive ? "Revocar acceso" : "Devolver acceso"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-neutral-600">{roleNotes[user.role]}</p>

      {!user.isAllowed ? (
        <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
          Su dirección ya no está en <span className="font-mono">ADMIN_ALLOWED_EMAILS</span>,
          así que no puede entrar aunque la fila diga que tiene acceso. La lista
          de permitidos se comprueba antes que nada.
        </p>
      ) : null}

      {/* ---------------------------- sesiones ----------------------------- */}
      <div className="flex flex-col gap-2 border-t border-neutral-900 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={labelStyle}>
            Sesiones abiertas ({user.sessions.length})
          </h3>
          {others.length > 0 ? (
            <button
              type="button"
              className={ghost}
              disabled={pending}
              onClick={() => actions.revokeOthers(user.id)}
            >
              Cerrar las {others.length === 1 ? "otra" : `otras ${others.length}`}
            </button>
          ) : null}
        </div>

        {user.sessions.length === 0 ? (
          <p className="text-[11px] text-neutral-600">
            Ninguna. No hay ningún navegador con la sesión iniciada.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {user.sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12px]"
              >
                <span className="min-w-0 flex-1 truncate text-neutral-300">
                  {describeUserAgent(session.userAgent)}
                  {session.isCurrent ? (
                    <span className="ml-2 rounded bg-green-950 px-1.5 py-0.5 font-mono text-[10px] text-green-400">
                      esta sesión
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                  {session.ipAddress ?? "sin IP"}
                </span>
                <span className="shrink-0 text-[11px] text-neutral-600">
                  {when(session.createdAt)} · {remaining(session.expiresAt)}
                </span>
                <button
                  type="button"
                  className={danger}
                  disabled={pending}
                  title={
                    session.isCurrent
                      ? "Cerrarla te devuelve a la pantalla de acceso"
                      : undefined
                  }
                  onClick={() => actions.revokeSession(session.id)}
                >
                  Cerrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function UsersModule({
  summary,
  currentRole,
  actions,
}: {
  summary: UsersSummary;
  currentRole: Role;
  actions: {
    setRole: (userId: string, role: Role) => Promise<ActionResult>;
    setActive: (userId: string, isActive: boolean) => Promise<ActionResult>;
    revokeSession: (sessionId: string) => Promise<ActionResult>;
    revokeOtherSessions: (userId: string) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const { users, allowlist, currentUserId } = summary;
  const canAdminister = currentRole === "owner";

  const run = (call: () => Promise<ActionResult>) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await call();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  };

  const missing = allowlist.filter(
    (email) => !users.some((u) => u.email.toLowerCase() === email),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sesiones activas, roles y revocación de acceso.
        </p>
      </header>

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

      {!canAdminister ? (
        <p className="rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-400">
          Puedes ver esta pantalla y cerrar tus propias sesiones, pero cambiar
          roles o revocar accesos es cosa de un propietario.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            users={users}
            currentUserId={currentUserId}
            canAdminister={canAdminister}
            pending={pending}
            actions={{
              setRole: (id, role) => run(() => actions.setRole(id, role)),
              setActive: (id, active) => run(() => actions.setActive(id, active)),
              revokeSession: (id) => run(() => actions.revokeSession(id)),
              revokeOthers: (id) => run(() => actions.revokeOtherSessions(id)),
            }}
          />
        ))}
      </ul>

      {/* --------------------------- la lista blanca ------------------------ */}
      <Section
        title="Quién puede entrar"
        note="El primero de los tres cerrojos, y el único que no se administra desde aquí: es una variable de entorno, así que invitar a alguien es un despliegue, no un botón."
      >
        <ul className="flex flex-col gap-1">
          {allowlist.length === 0 ? (
            <li className="text-[12px] text-red-400">
              <span className="font-mono">ADMIN_ALLOWED_EMAILS</span> está vacía:
              nadie puede crear una cuenta nueva.
            </li>
          ) : (
            allowlist.map((email) => (
              <li key={email} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-mono text-neutral-300">{email}</span>
                {missing.includes(email) ? (
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                    todavía no ha entrado
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>

        <p className="text-[11px] text-neutral-600">
          Google verifica la identidad, esta lista decide si se llega a crear la
          fila, y «revocar acceso» la desactiva después. Cada cerrojo funciona
          sin los otros dos: quitar a alguien de aquí no cierra sus sesiones, y
          revocarle el acceso no depende de que Google coopere.
        </p>
      </Section>
    </div>
  );
}
