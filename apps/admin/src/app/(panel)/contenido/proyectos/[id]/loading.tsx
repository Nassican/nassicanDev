import { SkeletonHeader, SkeletonPanel, SkeletonScreen } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonPanel lines={2} />
      <SkeletonPanel lines={6} />
    </SkeletonScreen>
  );
}
