import { AlertCircle, CheckCircle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ResponseDisplayProps {
  content: string | null;
  error: string | null;
  loading?: boolean;
  model?: string;
  finishReason?: string;
  requestId?: string;
}

export default function ResponseDisplay({
  content,
  error,
  loading,
  model,
  finishReason,
  requestId,
}: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Response</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <div className="bg-entropy-500 h-2 w-2 animate-pulse rounded-full" />
          <span>Generating response...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-red-700">Error</h3>
        </div>
        <p className="whitespace-pre-wrap font-mono text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">Send a prompt to see the response here</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <h3 className="font-semibold text-gray-900">Response</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="p-6">
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-gray-700">{content}</p>
        </div>
      </div>

      {(model || finishReason || requestId) && (
        <div className="flex flex-wrap gap-4 border-t border-gray-100 px-6 py-3 text-xs text-gray-400">
          {model && (
            <span>
              Model: <span className="font-medium text-gray-600">{model}</span>
            </span>
          )}
          {finishReason && (
            <span>
              Finish: <span className="font-medium text-gray-600">{finishReason}</span>
            </span>
          )}
          {requestId && (
            <span>
              Request ID:{' '}
              <span className="font-mono font-medium text-gray-600">
                {requestId.slice(0, 12)}...
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
