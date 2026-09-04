import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostEditor from "@/components/PostEditor";
import { getPostDraft } from "@/lib/posts";
import { deletePost, publishPost, savePost, unpublishPost } from "../actions";

export const metadata: Metadata = { title: "Editar artículo" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const post = await getPostDraft(id);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/contenido/blogs"
        className="w-fit text-xs text-neutral-500 transition-colors hover:text-neutral-300"
      >
        ← Blogs
      </Link>

      <PostEditor
        initial={post}
        actions={{
          save: savePost,
          publish: publishPost,
          unpublish: unpublishPost,
          remove: deletePost,
        }}
      />
    </div>
  );
}
