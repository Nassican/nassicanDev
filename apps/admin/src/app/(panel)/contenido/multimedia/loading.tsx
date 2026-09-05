import { SkeletonGrid, SkeletonHeader, SkeletonScreen } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <div className="h-9 w-full rounded bg-neutral-900" />
      <SkeletonGrid count={12} />
    </SkeletonScreen>
  );
}
