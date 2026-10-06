import { SkeletonHeader, SkeletonPanel, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <SkeletonRows count={8} />
        <SkeletonPanel lines={10} />
      </div>
    </SkeletonScreen>
  );
}
