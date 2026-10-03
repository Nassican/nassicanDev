import { SkeletonHeader, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonRows count={9} />
    </SkeletonScreen>
  );
}
