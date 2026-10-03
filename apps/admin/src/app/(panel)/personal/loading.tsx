import { SkeletonHeader, SkeletonPanel, SkeletonScreen, SkeletonTiles } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles />
      <SkeletonPanel lines={5} />
    </SkeletonScreen>
  );
}
