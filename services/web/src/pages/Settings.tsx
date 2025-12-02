export default function Settings() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Model Configuration</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Default Model</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              defaultValue="claude-sonnet-4-5"
            >
              <option value="claude-sonnet-4-5">Claude 4 Sonnet</option>
              <option value="claude-opus-4">Claude 4 Opus</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Anthropic API Key
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="sk-ant-..."
              defaultValue="••••••••••••••••"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">OpenAI API Key</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="sk-..."
              defaultValue=""
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Project Information</h2>

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Version:</span> 0.1.0
          </p>
          <p>
            <span className="text-gray-500">Environment:</span> Development
          </p>
        </div>
      </div>
    </div>
  );
}
