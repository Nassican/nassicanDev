import { SkeletonHeader, SkeletonPanel, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader action={false} />
      <SkeletonPanel lines={3} />
      <SkeletonRows count={4} />
    </SkeletonScreen>
  );
}
