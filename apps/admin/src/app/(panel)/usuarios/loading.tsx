import {
  SkeletonHeader,
  SkeletonPanel,
  SkeletonScreen,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader action={false} />
      <SkeletonPanel lines={2} />
      <SkeletonPanel lines={2} />
    </SkeletonScreen>
  );
}
