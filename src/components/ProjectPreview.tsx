"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  title: string;
  demo: string;
  image?: string | null;
};

export default function ProjectPreview({ title, demo, image }: Props) {
  const [autoImage, setAutoImage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!image && demo && demo !== "#") {
      const url = `/api/preview?url=${encodeURIComponent(demo)}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (!mounted) return;
          if (data?.ok && data?.imageUrl) setAutoImage(data.imageUrl as string);
        })
        .catch(() => void 0);
    }
    return () => {
      mounted = false;
    };
  }, [demo, image]);

  const src = image || autoImage;

  if (src) {
    const isExternal = /^https?:\/\//i.test(src);
    return (
      <a href={demo} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-xl">
        <div className="relative aspect-video w-full">
          {isExternal ? (
            <img src={src} alt={title} className="h-full w-full object-cover" />
          ) : (
            <Image
              src={src}
              alt={title}
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
              priority={false}
            />
          )}
        </div>
      </a>
    );
  }

  // Fallback placeholder
  return <div className="mb-3 aspect-video w-full rounded-xl bg-zinc-100 dark:bg-zinc-900" />;
}
