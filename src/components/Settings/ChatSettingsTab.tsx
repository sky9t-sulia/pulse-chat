import { useApp } from '../../context/AppContext';
import { CHAT_FONT_STACKS, CHAT_FONT_SIZE_STEPS } from '../../context/font-config';
import type { ChatFontFamily } from '../../types/types';
import { ThemedTextarea, ThemedSelect } from '../FormInputs';

const FONT_FAMILY_OPTIONS: { value: ChatFontFamily; label: string }[] = [
  { value: 'serif', label: 'Noto Serif' },
  { value: 'sans', label: 'Inter (Sans)' },
  { value: 'mono', label: 'JetBrains Mono' },
  { value: 'system', label: 'System Default' },
];

export function ChatSettingsTab() {
  const { chatSettings, setChatSettings } = useApp();
  const minStep = 0;
  const maxStep = CHAT_FONT_SIZE_STEPS.length - 1;
  const currentStep = Math.max(
    0,
    (CHAT_FONT_SIZE_STEPS as readonly number[]).indexOf(chatSettings.font_size)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-10">
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">System Prompt</label>
        <ThemedTextarea
          value={chatSettings.system_prompt}
          onChange={(e) => setChatSettings({ ...chatSettings, system_prompt: e.target.value })}
          placeholder="Optional — sent as the system message on every request."
          className="resize-y h-24"
        />
        <p className="text-xs theme-text-muted mt-1">
          Applied to new messages in every conversation.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Font</label>
        <ThemedSelect
          value={chatSettings.font_family}
          onChange={(e) =>
            setChatSettings({
              ...chatSettings,
              font_family: e.target.value as ChatFontFamily,
            })
          }
        >
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </ThemedSelect>
        <p
          className="text-xs theme-text-muted mt-2"
          style={{ fontFamily: CHAT_FONT_STACKS[chatSettings.font_family] }}
        >
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-gray-400">Font Size</label>
          <span className="text-xs theme-text-secondary font-mono">
            {chatSettings.font_size}px
          </span>
        </div>
        <input
          type="range"
          min={minStep}
          max={maxStep}
          step={1}
          value={currentStep}
          onChange={(e) =>
            setChatSettings({
              ...chatSettings,
              font_size: CHAT_FONT_SIZE_STEPS[Number(e.target.value)],
            })
          }
          className="w-full accent-gray-500"
        />
        <div className="flex justify-between text-[10px] theme-text-muted mt-1 font-mono">
          {CHAT_FONT_SIZE_STEPS.map((s: number) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-gray-400">Max tool calls per message</label>
          <span className="text-xs theme-text-secondary font-mono">
            {chatSettings.max_calls_per_tool}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={chatSettings.max_calls_per_tool}
          onChange={(e) =>
            setChatSettings({
              ...chatSettings,
              max_calls_per_tool: Number(e.target.value),
            })
          }
          className="w-full accent-gray-500"
        />
        <p className="text-xs theme-text-muted mt-1">
          How many times the model can call the same tool in one turn before it&apos;s asked to answer with what it has.
        </p>
      </div>
    </div>
  );
}
