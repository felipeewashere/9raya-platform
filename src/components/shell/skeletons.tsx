import { Skeleton } from "@/components/ui/skeleton";


export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-10" aria-busy="true" aria-label="Chargement">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-4 w-28" />
        <Skeleton className="mx-auto h-9 w-72" />
        <Skeleton className="mx-auto h-4 w-96 max-w-full" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-52" />
          <div className="space-y-2 sm:ml-10">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CourseSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8" aria-busy="true" aria-label="Chargement du cours">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-4 w-28" />
        <Skeleton className="mx-auto h-9 w-64" />
        <Skeleton className="mx-auto h-1.5 w-80" />
      </div>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-6 w-56" />
      <div className="space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </div>
  );
}

export function LessonSkeleton() {
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
