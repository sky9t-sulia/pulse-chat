import { Square, MoveUp } from 'lucide-react';

interface SendButtonProps {
  isStreaming: boolean;
  hasInput: boolean;
  onSend: () => void;
  onStop: () => void;
}

export function SendButton({ isStreaming, hasInput, onSend, onStop }: SendButtonProps) {
  const handleClick = isStreaming ? onStop : onSend;

  return (
    <button
      onClick={handleClick}
      disabled={!isStreaming && !hasInput}
      title={isStreaming ? 'Stop generating' : 'Send'}
      className={`p-2 rounded-md transition-all flex-shrink-0 ${
        isStreaming
          ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
          : hasInput
            ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
            : 'bg-transparent theme-text-muted cursor-not-allowed'
      }`}
    >
      {isStreaming ? (
        <Square className="w-4 h-4 fill-current" />
      ) : (
        <MoveUp className="w-4 h-4" />
      )}
    </button>
  );
}
