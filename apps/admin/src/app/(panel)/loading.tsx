import {
  SkeletonHeader,
  SkeletonPanel,
  SkeletonRows,
  SkeletonScreen,
  SkeletonTiles,
} from "@/components/Skeleton";

/**
 * Covers the dashboard and every panel route that does not define its own. A
 * generic shape is the right default: promising the wrong one is worse than
 * promising none.
 */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonRows count={3} />
      <SkeletonTiles />
      <SkeletonPanel lines={2} />
    </SkeletonScreen>
  );
}
