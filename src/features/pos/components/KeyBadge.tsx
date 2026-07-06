export function KeyBadge({ keyName, label }: { keyName: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded bg-secondary/80 border border-border min-w-[52px]">
      <span className="text-[10px] font-bold text-foreground">{keyName}</span>
      <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}
