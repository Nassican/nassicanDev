import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";

export const metadata: Metadata = {
  title: "404 | Nassican",
};

export default function NotFound() {
  return <NotFoundContent />;
}
