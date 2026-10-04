import {
  SkeletonHeader,
  SkeletonRows,
  SkeletonScreen,
  SkeletonTiles,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles />
      <SkeletonRows count={8} />
    </SkeletonScreen>
  );
}
