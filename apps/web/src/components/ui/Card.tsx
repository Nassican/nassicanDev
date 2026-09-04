import { HTMLAttributes } from "react";

export default function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-black/10 p-5 shadow-sm transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/30 ${className}`}
      {...props}
    />
  );
}
