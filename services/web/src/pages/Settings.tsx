export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Model Configuration</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Model
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              defaultValue="claude-sonnet-4-5"
            >
              <option value="claude-sonnet-4-5">Claude 4 Sonnet</option>
              <option value="claude-opus-4">Claude 4 Opus</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anthropic API Key
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="sk-ant-..."
              defaultValue="••••••••••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="sk-..."
              defaultValue=""
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Project Information</h2>

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
