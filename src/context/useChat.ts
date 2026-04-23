import { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from './AppContext';
import type { Provider, Message } from '../types';

export function useChat() {
  const { messages, activeConversationId, addMessage } = useApp();
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null!);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const send = useCallback(
    async (content: string, provider: Provider) => {
      if (!activeConversationId || isStreaming) return;

      await addMessage(activeConversationId, 'user', content);

      const chatMessages = messages
        .concat({ id: '', role: 'user', content, created_at: Date.now() } as Message)
        .map((m) => ({ role: m.role, content: m.content }));

      setIsStreaming(true);
      setStreamingContent('');

      let currentContent = '';

      try {
        const response = await fetch(provider.api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.api_key}`,
          },
          body: JSON.stringify({
            model: provider.default_model,
            messages: chatMessages,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          setStreamingContent(`[Error ${response.status}: ${errorText}]`);
          setIsStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setStreamingContent('[Error: No stream available]');
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        abortRef.current = () => {
          reader.cancel();
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const contentChunk = json.choices?.[0]?.delta?.content;
              if (contentChunk) {
                currentContent += contentChunk;
                setStreamingContent(currentContent);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        reader.releaseLock();
        abortRef.current = null;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setStreamingContent(`[Error: ${err.message}]`);
        }
      }

      if (currentContent) {
        await addMessage(
          activeConversationId,
          'assistant',
          currentContent,
          provider.default_model
        );
      }

      setStreamingContent('');
      setIsStreaming(false);
    },
    [activeConversationId, isStreaming, messages, addMessage]
  );

  const stop = useCallback(() => {
    abortRef.current?.();
    setIsStreaming(false);
  }, []);

  return {
    streamingContent,
    isStreaming,
    scrollRef,
    send,
    stop,
  };
}
