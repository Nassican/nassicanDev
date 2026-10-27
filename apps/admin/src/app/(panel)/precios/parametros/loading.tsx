import { SkeletonGrid, SkeletonHeader, SkeletonScreen } from "@/components/Skeleton";
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonGrid count={6} />
    </SkeletonScreen>
  );
}
