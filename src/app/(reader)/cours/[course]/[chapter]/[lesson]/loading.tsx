import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement de la leçon">
      <div className="h-12 border-b border-primary/25" />
      <div className="mx-auto max-w-[46rem] space-y-5 px-4 pt-10">
        <Skeleton className="mx-auto h-4 w-48" />
        <Skeleton className="mx-auto h-10 w-3/4" />
        <Skeleton className="mx-auto h-5 w-2/3" />
        <Skeleton className="mt-6 h-6 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}
