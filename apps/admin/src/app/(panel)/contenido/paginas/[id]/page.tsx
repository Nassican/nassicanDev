import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageEditor from "@/components/PageEditor";
import { getPageDraft } from "@/lib/pages";
import { deletePage, publishPage, savePage, unpublishPage } from "../actions";

export const metadata: Metadata = { title: "Editar página" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPagePage({ params }: PageProps) {
  const { id } = await params;
  const page = await getPageDraft(id);
  if (!page) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/contenido/paginas"
        className="w-fit text-xs text-neutral-500 transition-colors hover:text-neutral-300"
      >
        ← Páginas
      </Link>

      <PageEditor
        initial={page}
        actions={{
          save: savePage,
          publish: publishPage,
          unpublish: unpublishPage,
          remove: deletePage,
        }}
      />
    </div>
  );
}
