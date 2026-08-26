import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline";
};

export function buttonClassName(
  variant: "solid" | "outline" = "solid",
  className = "",
) {
  const base = "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm transition-colors";
  const styles =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-black/80 dark:hover:bg-white/80"
      : "border border-black/20 hover:bg-black/5 dark:border-white/30 dark:hover:bg-white/10";
  return `${base} ${styles} ${className}`;
}

export default function Button({ variant = "solid", className = "", ...props }: Props) {
  return <button className={buttonClassName(variant, className)} {...props} />;
}
