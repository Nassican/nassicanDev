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
      <SkeletonPanel lines={0} />
      <SkeletonRows count={5} />
      <SkeletonRows count={6} />
      <SkeletonRows count={8} />
    </SkeletonScreen>
  );
}
