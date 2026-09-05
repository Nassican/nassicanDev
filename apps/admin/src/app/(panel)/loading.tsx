import { SkeletonHeader, SkeletonPanel, SkeletonScreen } from "@/components/Skeleton";

/**
 * Covers every panel route that does not define its own. A generic shape is
 * the right default: promising the wrong one is worse than promising none.
 */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonPanel />
      <SkeletonPanel lines={2} />
    </SkeletonScreen>
  );
}
