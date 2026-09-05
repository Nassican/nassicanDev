import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectEditor from "@/components/ProjectEditor";
import { getProjectDraft, listTechnologies } from "@/lib/projects";
import {
  deleteProject,
  publishProject,
  saveProject,
  unpublishProject,
} from "../actions";

export const metadata: Metadata = { title: "Editar proyecto" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const [project, technologies] = await Promise.all([
    getProjectDraft(id),
    listTechnologies(),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/contenido/proyectos"
        className="w-fit text-xs text-neutral-500 transition-colors hover:text-neutral-300"
      >
        ← Proyectos
      </Link>

      <ProjectEditor
        initial={project}
        technologies={technologies}
        actions={{
          save: saveProject,
          publish: publishProject,
          unpublish: unpublishProject,
          remove: deleteProject,
        }}
      />
    </div>
  );
}
