import { SkeletonHeader, SkeletonPanel, SkeletonRows, SkeletonScreen, SkeletonTiles } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles count={3} />
      <SkeletonPanel lines={3} />
      <SkeletonRows count={7} />
    </SkeletonScreen>
  );
}
