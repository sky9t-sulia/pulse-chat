interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Dialog({ open, onClose, children, title }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[var(--bg-main)] border theme-border-light rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto z-10">
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b theme-border-light">
            <h3 className="text-sm font-medium theme-text-heading">{title}</h3>
            <button
              onClick={onClose}
              className="theme-text-secondary hover-theme-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
