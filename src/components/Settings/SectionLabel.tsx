interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  const base = 'text-[11px] mb-1 flex items-left font-medium theme-text-muted uppercase tracking-wider';
  return <div className={`${base} block mb-1 ${className}`}>{children}</div>;
}
  