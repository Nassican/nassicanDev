import { HTMLAttributes } from "react";

export default function SectionTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-xl font-semibold tracking-tight ${className}`} {...props} />;
}
