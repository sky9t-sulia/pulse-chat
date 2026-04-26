import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash2, RotateCcw, Wrench, Loader2, Check, AlertCircle } from 'lucide-react';
import type { Message } from '../../types/types';
import type { ToolInvocation } from '../../hooks/useChat';
import { MessageContent } from './MessageContent';
import { ReasoningBlock } from './ReasoningBlock';

export function ToolInvocationRow({ inv }: { inv: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false);

  let prettyArgs = inv.arguments;
  try {
    prettyArgs = JSON.stringify(JSON.parse(inv.arguments), null, 2);
  } catch {
    // leave as-is if not valid JSON
  }

  const statusIcon =
    inv.status === 'running' ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin theme-text-muted" />
    ) : inv.status === 'error' ? (
      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
    ) : (
      <Check className="w-3.5 h-3.5 text-green-400" />
    );

  const statusLabel =
    inv.status === 'running'
      ? 'Running...'
      : inv.status === 'error'
        ? 'Error'
        : inv.durationMs != null
          ? `${(inv.durationMs / 1000).toFixed(2)}s`
          : 'Done';

  return (
    <div className="mb-2 border theme-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((expanded) => !expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:theme-sidebar-hover transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 theme-text-muted shrink-0" />
        <span className="text-xs font-mono theme-text-primary">{inv.name}</span>
        <span className="text-xs theme-text-muted flex-1 truncate">
          {inv.arguments.length > 80 ? inv.arguments.slice(0, 80) + '...' : inv.arguments}
        </span>
        {statusIcon}
        <span className="text-[10px] theme-text-muted font-mono">{statusLabel}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 theme-text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 theme-text-muted" />
        )}
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t theme-border text-xs theme-text">
          <div className="theme-text-muted uppercase tracking-wide text-[10px] mb-1">Arguments</div>
          <pre className="whitespace-pre-wrap font-mono theme-text-secondary mb-3 max-h-40 overflow-auto">{prettyArgs}</pre>
          {(inv.result || inv.error) && (
            <>
              <div className="theme-text-muted uppercase tracking-wide text-[10px] mb-1">
                {inv.error ? 'Error' : 'Result'}
              </div>
              <pre className="whitespace-pre-wrap font-mono theme-text-secondary max-h-60 overflow-auto">
                {inv.error || inv.result}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  disabled,
  onResend,
  onRegenerate,
  onDelete,
}: {
  message: Message;
  disabled?: boolean;
  onResend?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`group flex flex-col w-full min-w-0 ${isUser ? 'items-end' : 'items-start'} mb-6`}>
      <div
        className={`chat-content max-w-full min-w-0 ${
          isUser
            ? 'theme-input px-4 py-2.5 rounded-2xl rounded-br-md'
            : 'w-full'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.tool_invocations && message.tool_invocations.length > 0 && (
              <div className="mb-3">
                {message.tool_invocations.map((inv) => (
                  <ToolInvocationRow key={inv.id} inv={inv} />
                ))}
              </div>
            )}
            {message.reasoning && <ReasoningBlock reasoning={message.reasoning} />}
            <MessageContent content={message.content} />
          </>
        )}
      </div>

      <div className="mt-1 h-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isUser && onResend && (
          <button
            type="button"
            onClick={() => onResend(message.id)}
            disabled={disabled}
            title="Resend"
            className="p-1 rounded theme-text-muted hover-theme-text-primary hover:theme-sidebar-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {!isUser && onRegenerate && (
          <button
            type="button"
            onClick={() => onRegenerate(message.id)}
            disabled={disabled}
            title="Regenerate"
            className="p-1 rounded theme-text-muted hover-theme-text-primary hover:theme-sidebar-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            disabled={disabled}
            title="Delete"
            className="p-1 rounded theme-text-muted hover:text-red-400 hover:theme-sidebar-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {!isUser && message.output_tokens && message.duration_ms ? (
          <span
            className="ml-1 text-[10px] font-mono theme-text-muted"
            title={`${message.output_tokens} tokens in ${(message.duration_ms / 1000).toFixed(2)}s`}
          >
            {(message.output_tokens / (message.duration_ms / 1000)).toFixed(1)} tok/s
          </span>
        ) : null}
      </div>
    </div>
  );
});
