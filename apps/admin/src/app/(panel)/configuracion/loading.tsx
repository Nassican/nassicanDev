import {
  SkeletonHeader,
  SkeletonPanel,
  SkeletonRows,
  SkeletonScreen,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonPanel lines={6} />
      <SkeletonRows count={4} />
      <SkeletonRows count={8} />
    </SkeletonScreen>
  );
}
