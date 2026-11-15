/** Shown while a scene is not built yet. */
export function SimPlaceholder({ name }: { name: string }) {
  return (
    <div className="grid aspect-video place-items-center bg-muted text-muted-foreground">
      <p className="label">Simulation « {name} » — bientôt</p>
    </div>
  );
}
