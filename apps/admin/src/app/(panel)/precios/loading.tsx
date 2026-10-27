import { SkeletonGrid, SkeletonHeader, SkeletonScreen } from "@/components/Skeleton";
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]">
        <SkeletonGrid count={3} />
        <SkeletonGrid count={1} />
      </div>
    </SkeletonScreen>
  );
}
