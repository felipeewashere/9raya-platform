import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
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
