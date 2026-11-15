import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
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
