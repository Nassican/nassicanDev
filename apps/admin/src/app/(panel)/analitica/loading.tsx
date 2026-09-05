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
      {/* The chart is the tall one; leaving its height out would make the page
          jump when the real data lands. */}
      <div className="h-64 rounded-lg border border-neutral-900 bg-neutral-950" />
      <SkeletonRows count={6} />
      <SkeletonPanel lines={0} />
    </SkeletonScreen>
  );
}
