import { useState, useMemo } from 'react';
import { Button } from '../shared';
import type { UserSettings } from '../../lib/types';

type AIProvider = 'openrouter' | 'gemini' | 'openai';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openrouter: 'OpenRouter',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
};

const MODELS_BY_PROVIDER: Record<AIProvider, { value: string; label: string }[]> = {
  openrouter: [
    { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4 (recommended)' },
    { value: 'anthropic/claude-haiku', label: 'Claude Haiku (faster, cheaper)' },
    { value: 'anthropic/claude-opus-4', label: 'Claude Opus 4 (most capable)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
};

const RESPONSE_LENGTH_OPTIONS = [
  { value: 512, label: 'Short' },
  { value: 1024, label: 'Medium' },
  { value: 2048, label: 'Long' },
];

const CONTEXT_DEPTH_OPTIONS = [
  { value: 'short', label: 'Light' },
  { value: 'medium', label: 'Standard' },
  { value: 'long', label: 'Deep' },
];

interface AIConfigSectionProps {
  settings: UserSettings | null;
  onUpdateSetting: (key: string, value: unknown) => Promise<void>;
  onSaveApiKey: (key: string) => Promise<{ error: string | null }>;
  onClearApiKey: () => Promise<void>;
  onTestConnection: (provider: string, apiKey: string, model: string) => Promise<{ success: boolean; error?: string }>;
}

export function AIConfigSection({
  settings,
  onUpdateSetting,
  onSaveApiKey,
  onClearApiKey,
  onTestConnection,
}: AIConfigSectionProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const provider = (settings?.ai_provider || 'openrouter') as AIProvider;
  const hasKey = !!settings?.ai_api_key_encrypted;

  const models = useMemo(() => MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.openrouter, [provider]);

  const handleTestAndSave = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);

    const model = models[0]?.value || 'anthropic/claude-sonnet-4';
    const result = await onTestConnection(provider, apiKey.trim(), model);
    setTestResult(result);
    setTesting(false);

    if (result.success) {
      setSaving(true);
      await onSaveApiKey(apiKey.trim());
      setSaving(false);
      setApiKey('');
      setShowKeyInput(false);
    }
  };

  const handleClear = async () => {
    await onClearApiKey();
    setTestResult(null);
  };

  return (
    <div className="settings-section__body">
      <p className="settings-section__helper">
        The defaults work great. You only need to change these if you have your own AI API key.
      </p>

      {/* Provider */}
      <div className="settings-field">
        <label className="settings-field__label">AI Provider</label>
        <select
          className="settings-field__select"
          value={provider}
          onChange={e => onUpdateSetting('ai_provider', e.target.value)}
        >
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="settings-field">
        <label className="settings-field__label">API Key</label>
        {!hasKey && !showKeyInput && (
          <div className="settings-field__key-status">
            <span className="settings-field__key-label">Using developer key (no setup needed)</span>
            <Button variant="secondary" onClick={() => setShowKeyInput(true)}>
              Add your own key
            </Button>
          </div>
        )}
        {hasKey && !showKeyInput && (
          <div className="settings-field__key-status">
            <span className="settings-field__key-label settings-field__key-label--active">
              Custom key active
            </span>
            <div className="settings-field__actions">
              <Button variant="secondary" onClick={() => setShowKeyInput(true)}>
                Change
              </Button>
              <Button variant="secondary" onClick={handleClear}>
                Clear (use developer key)
              </Button>
            </div>
          </div>
        )}
        {showKeyInput && (
          <div className="settings-field__key-form">
            <input
              type="password"
              className="settings-field__input"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
              autoComplete="off"
            />
            {testResult && !testResult.success && (
              <div className="settings-field__error">{testResult.error || 'Connection failed'}</div>
            )}
            {testResult?.success && (
              <div className="settings-field__success">Connection successful — key saved</div>
            )}
            <div className="settings-field__actions">
              <Button variant="secondary" onClick={() => { setShowKeyInput(false); setApiKey(''); setTestResult(null); }}>
                Cancel
              </Button>
              <Button onClick={handleTestAndSave} disabled={!apiKey.trim() || testing || saving}>
                {testing ? 'Testing...' : saving ? 'Saving...' : 'Save & Test'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Model */}
      <div className="settings-field">
        <label className="settings-field__label">AI Model</label>
        <select
          className="settings-field__select"
          value={settings?.ai_model || models[0]?.value || ''}
          onChange={e => onUpdateSetting('ai_model', e.target.value)}
        >
          {models.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Response Length */}
      <div className="settings-field">
        <label className="settings-field__label">Response Length</label>
        <select
          className="settings-field__select"
          value={settings?.max_tokens || 1024}
          onChange={e => onUpdateSetting('max_tokens', parseInt(e.target.value, 10))}
        >
          {RESPONSE_LENGTH_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Context Depth */}
      <div className="settings-field">
        <label className="settings-field__label">Context Depth</label>
        <select
          className="settings-field__select"
          value={settings?.context_window_size || 'medium'}
          onChange={e => onUpdateSetting('context_window_size', e.target.value)}
        >
          {CONTEXT_DEPTH_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="settings-field__hint">
          More context = richer responses but higher cost
        </span>
      </div>
    </div>
  );
}
