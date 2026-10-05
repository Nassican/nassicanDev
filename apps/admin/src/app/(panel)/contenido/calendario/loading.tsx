import { SkeletonGrid, SkeletonHeader, SkeletonScreen, SkeletonTiles } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles count={5} />
      <SkeletonGrid count={14} />
    </SkeletonScreen>
  );
}
