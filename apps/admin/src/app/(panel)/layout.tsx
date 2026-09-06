import PanelShell from "@/components/PanelShell";
import { requireUser } from "@/lib/session";

/**
 * Everything inside this route group is behind the session check. `requireUser`
 * runs before any child renders, so a page component never has to ask whether
 * there is a user.
 *
 * The frame itself lives in `PanelShell`, which is a client component: the menu
 * has to know which route is open. Only the four fields it shows are handed
 * over - passing the whole user object would send `isActive` and the login
 * timestamp to the browser for no reason.
 */
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <PanelShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    >
      {children}
    </PanelShell>
  );
}
