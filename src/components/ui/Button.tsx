import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline";
};

export default function Button({ variant = "solid", className = "", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-full px-5 h-11 text-sm transition-colors";
  const styles =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-black/80 dark:hover:bg-white/80"
      : "border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
