import { SkeletonHeader, SkeletonPanel, SkeletonScreen } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonPanel lines={6} />
      <SkeletonPanel lines={4} />
      <SkeletonPanel lines={4} />
    </SkeletonScreen>
  );
}
