import { SkeletonHeader, SkeletonRows, SkeletonScreen, SkeletonTiles } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles count={3} />
      <SkeletonRows count={6} />
    </SkeletonScreen>
  );
}
