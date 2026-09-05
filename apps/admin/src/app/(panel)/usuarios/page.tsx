import type { Metadata } from "next";
import UsersModule from "@/components/UsersModule";
import { requireUser } from "@/lib/session";
import { getUsers, type Role } from "@/lib/users";
import {
  revokeOtherSessions,
  revokeSession,
  setActive,
  setRole,
} from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  // The layout already ran this, but the page needs the id and role to decide
  // what to render, and re-reading is one query at the cost of guessing none.
  const user = await requireUser();
  const summary = await getUsers(user.id);

  return (
    <UsersModule
      summary={summary}
      currentRole={user.role as Role}
      actions={{ setRole, setActive, revokeSession, revokeOtherSessions }}
    />
  );
}
