import {
  SkeletonHeader,
  SkeletonPanel,
  SkeletonRows,
  SkeletonScreen,
  SkeletonTiles,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonPanel lines={6} />
      <SkeletonRows count={3} />
      <SkeletonTiles />
    </SkeletonScreen>
  );
}
