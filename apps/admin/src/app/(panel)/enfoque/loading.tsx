import { SkeletonHeader, SkeletonPanel, SkeletonRows, SkeletonScreen, SkeletonTiles } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader action={false} />
      <SkeletonPanel lines={5} />
      <SkeletonTiles count={3} />
      <SkeletonRows count={5} />
    </SkeletonScreen>
  );
}
