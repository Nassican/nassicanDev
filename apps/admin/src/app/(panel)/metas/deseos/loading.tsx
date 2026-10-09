import { SkeletonGrid, SkeletonHeader, SkeletonScreen, SkeletonTiles } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles count={4} />
      <SkeletonGrid count={4} />
    </SkeletonScreen>
  );
}
