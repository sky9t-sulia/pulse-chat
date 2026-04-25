import type { ToolInvocation, ApiMessage, ApiToolCall } from '../../types/streaming-api';

export interface ToolCallResult {
  toolCalls: ApiToolCall[];
  collectedInvocations: ToolInvocation[];
  toolMessages: ApiMessage[];
}

export async function executeToolCalls(
  toolCalls: ApiToolCall[],
  collectedInvocations: ToolInvocation[],
  toolCallCounts: Record<string, number>,
  maxCallsPerTool: number,
  setToolInvocations: (inv: ToolInvocation[]) => void,
): Promise<ToolCallResult> {
  const toolMessages: ApiMessage[] = [];

  for (const tc of toolCalls) {
    const toolName = tc.function.name;
    const count = (toolCallCounts[toolName] || 0) + 1;
    toolCallCounts[toolName] = count;

    const runningEntry: ToolInvocation = {
      id: tc.id,
      name: toolName,
      arguments: tc.function.arguments,
      status: 'running',
    };
    collectedInvocations.push(runningEntry);
    setToolInvocations([...collectedInvocations]);

    const startedAt = Date.now();
    let toolResultContent = '';
    let toolError: string | undefined;

    if (count > maxCallsPerTool) {
      toolError = `Tool '${toolName}' call limit reached (${maxCallsPerTool} per message). Answer the user with what you already have.`;
    } else {
      try {
        const toolRes = await window.chatApi.tools.execute(toolName, tc.function.arguments);
        toolResultContent = toolRes.content;
        toolError = toolRes.error;
      } catch (err: unknown) {
        toolError = err instanceof Error ? err.message : String(err);
      }
    }

    const durationMs = Date.now() - startedAt;
    runningEntry.status = toolError ? 'error' : 'done';
    runningEntry.result = toolResultContent;
    runningEntry.error = toolError;
    runningEntry.durationMs = durationMs;
    setToolInvocations([...collectedInvocations]);

    toolMessages.push({
      role: 'tool',
      tool_call_id: tc.id,
      name: toolName,
      content: toolError ? `[Error: ${toolError}]\n${toolResultContent}` : toolResultContent,
    });
  }

  return { toolCalls, collectedInvocations, toolMessages };
}
