import { Send, Loader2 } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string, systemPrompt?: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function PromptInput({ onSubmit, loading, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !loading && !disabled) {
      onSubmit(prompt.trim(), systemPrompt.trim() || undefined);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (prompt.trim() && !loading && !disabled) {
        onSubmit(prompt.trim(), systemPrompt.trim() || undefined);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Test Prompt</h3>
        <button
          type="button"
          onClick={() => setShowSystemPrompt(!showSystemPrompt)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {showSystemPrompt ? 'Hide' : 'Show'} System Prompt
        </button>
      </div>

      {showSystemPrompt && (
        <div className="mb-3">
          <label className="mb-1 block text-sm text-gray-500">System Prompt (optional)</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant..."
            className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-entropy-500 focus:outline-none focus:ring-1 focus:ring-entropy-500"
            rows={2}
            disabled={loading || disabled}
          />
        </div>
      )}

      <div className="mb-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your test prompt here..."
          className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 focus:border-entropy-500 focus:outline-none focus:ring-1 focus:ring-entropy-500"
          rows={4}
          disabled={loading || disabled}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Press Cmd+Enter to send</span>
        <button
          type="submit"
          disabled={!prompt.trim() || loading || disabled}
          className="bg-entropy-600 hover:bg-entropy-700 disabled:bg-entropy-300 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Send Request</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
