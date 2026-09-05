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
      <SkeletonTiles count={8} />
      <SkeletonPanel lines={0} />
      <SkeletonRows count={4} />
    </SkeletonScreen>
  );
}
