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
      <SkeletonTiles />
      <SkeletonPanel lines={4} />
      <SkeletonRows count={10} />
    </SkeletonScreen>
  );
}
