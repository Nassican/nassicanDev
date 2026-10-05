import type { Metadata } from "next";
import FocusModule from "@/components/FocusModule";
import { getFocus } from "@/lib/focus";
import { discardFocus, finishFocus, saveReturnNote, startFocus } from "./actions";

export const metadata: Metadata = { title: "Enfoque" };

export default async function EnfoquePage() {
  const view = await getFocus();
  return (
    <FocusModule
      view={view}
      actions={{ start: startFocus, finish: finishFocus, note: saveReturnNote, discard: discardFocus }}
    />
  );
}
