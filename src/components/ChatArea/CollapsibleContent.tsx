export function CollapsibleContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 px-4 py-3 text-sm theme-text whitespace-pre-wrap border theme-border rounded-lg max-h-[400px] overflow-y-auto">
      {children}
    </div>
  );
}
