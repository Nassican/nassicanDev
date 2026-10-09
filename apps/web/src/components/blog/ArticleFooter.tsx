import Image from "next/image";
import Link from "next/link";
import { BsArrowLeft, BsArrowRight, BsLink45Deg, BsLinkedin, BsTwitterX } from "react-icons/bs";
import CopyButton from "@/components/ui/CopyButton";
import { readingMinutes, type Post, type Profile } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

const eyebrow = "text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400";
const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5";

/**
 * What comes after the last paragraph: the topics, a way to pass the article
 * on, who wrote it, and where to go next.
 *
 * It is the part a reader who finished actually sees, and before this the page
 * simply stopped. The order is the order of the questions at that moment — what
 * was this about, who is this, what else is there — and the way back to the
 * index comes last because the list above it is the better answer.
 */
export default function ArticleFooter({
  post,
  related,
  profile,
  avatar,
  url,
  locale,
  t,
}: {
  post: Post;
  related: Post[];
  profile: Profile;
  avatar: string;
  /** The article's canonical address, which is what gets shared. */
  url: string;
  locale: Locale;
  t: Dictionary;
}) {
  const title = post.content[locale].title;
  const share = [
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      icon: <BsLinkedin className="h-3.5 w-3.5" aria-hidden />,
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      icon: <BsTwitterX className="h-3.5 w-3.5" aria-hidden />,
    },
  ];

  return (
    <footer className="mt-16 flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-black/10 pt-6 dark:border-white/10">
        <ul className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {post.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-black/10 px-2.5 py-1 dark:border-white/10">
              {tag}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <span className={eyebrow}>{t.blog.share}</span>
          <CopyButton
            text={url}
            label={t.blog.copyLink}
            done={t.blog.linkCopied}
            icon={<BsLink45Deg className="h-4 w-4" aria-hidden />}
            className={pill}
          />
          {share.map((network) => (
            <a
              key={network.name}
              href={network.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t.blog.shareOn} ${network.name}`}
              className={pill}
            >
              {network.icon}
              {network.name}
            </a>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-black/10 p-6 sm:flex-row sm:items-center dark:border-white/10">
        <Image src={avatar} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className={eyebrow}>{t.blog.writtenBy}</p>
          <p className="mt-1 text-base font-semibold">
            <Link href={localePath(locale, "/")} rel="author" className="underline-offset-4 hover:underline">
              {profile.name}
            </Link>
          </p>
          {profile.title[locale] ? (
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{profile.title[locale]}</p>
          ) : null}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.socials.map((social) => (
              <li key={social.href}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="text-zinc-700 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                >
                  {social.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href={localePath(locale, "/#contact")}
                className="text-zinc-700 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                {t.blog.contact}
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="keep-reading">
          <h2 id="keep-reading" className={eyebrow}>
            {t.blog.keepReading}
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
            {related.map((other) => {
              const c = other.content[locale];
              return (
                <li key={other.slug}>
                  <Link
                    href={localePath(locale, `/blog/${other.slug}`)}
                    className="group flex items-center gap-4 py-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-zinc-900 underline-offset-4 group-hover:underline dark:text-zinc-100">
                        {c.title}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-zinc-600 dark:text-zinc-400">
                        {c.description}
                      </span>
                      <span className="mt-1.5 block text-xs text-zinc-600 dark:text-zinc-400">
                        <time dateTime={other.date}>{formatDate(locale, other.date)}</time>
                        <span aria-hidden> · </span>
                        {readingMinutes(c.body)} {t.blog.readingTime}
                      </span>
                    </span>
                    <BsArrowRight
                      className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div>
        <Link href={localePath(locale, "/blog")} className={pill}>
          <BsArrowLeft className="h-4 w-4" aria-hidden />
          {t.blog.back}
        </Link>
      </div>
    </footer>
  );
}
