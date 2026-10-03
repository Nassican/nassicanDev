import {
  SkeletonHeader,
  SkeletonRows,
  SkeletonScreen,
  SkeletonTiles,
} from "@/components/Skeleton";

/**
 * The shape the page lands in: four figures above a list. No panel block,
 * because the editor is closed until you press «Añadir».
 */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonHeader />
      <SkeletonTiles />
      <SkeletonRows count={8} />
    </SkeletonScreen>
  );
}
