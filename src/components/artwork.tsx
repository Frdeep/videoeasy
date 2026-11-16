export function Artwork({
  variant = "orb",
  label,
}: {
  variant?: string;
  label: string;
}) {
  return (
    <div className={`artwork art-${variant}`} role="img" aria-label={label}>
      <div className="art-glow" />
      <div className="art-object" />
      <div className="art-ring" />
      <div className="art-grain" />
    </div>
  );
}
