import type { Metadata } from "next";
import SkillsModule from "@/components/SkillsModule";
import { getSkills } from "@/lib/skills";
import { chooseIcon, clearIcon, findIcons, previewIcon, setColor } from "./actions";

export const metadata: Metadata = { title: "Habilidades" };

export default async function HabilidadesPage() {
  const summary = await getSkills();

  return (
    <SkillsModule
      summary={summary}
      actions={{
        find: findIcons,
        preview: previewIcon,
        choose: chooseIcon,
        clear: clearIcon,
        setColor,
      }}
    />
  );
}
