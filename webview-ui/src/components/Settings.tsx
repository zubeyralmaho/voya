import React, { useState, useEffect } from 'react';

interface SettingsProps {
  onBack: () => void;
  vscode: any;
}

interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
}

const MODELS = {
  openai: [
    { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ],
  anthropic: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
  ]
};

const Settings: React.FC<SettingsProps> = ({ onBack, vscode }) => {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4-turbo-preview'
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Request current settings
    vscode.postMessage({ type: 'getSettings' });
    
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'settingsLoaded') {
        setConfig({
          provider: message.provider || 'openai',
          apiKey: message.apiKey || '',
          model: message.model || 'gpt-4-turbo-preview'
        });
        setLoading(false);
      } else if (message.type === 'settingsSaved') {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleSave = () => {
    vscode.postMessage({
      type: 'saveSettings',
      ...config
    });
  };

  const handleProviderChange = (provider: 'openai' | 'anthropic') => {
    setConfig({
      ...config,
      provider,
      model: MODELS[provider][0].id
    });
  };

  const maskApiKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          Back
        </button>
        <h1 style={styles.title}>Settings</h1>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* API Configuration Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>API Configuration</h2>
          <p style={styles.sectionDescription}>
            Configure your LLM provider to enable AI-powered code explanations.
          </p>

          {/* Provider Selection */}
          <div style={styles.field}>
            <label style={styles.label}>Provider</label>
            <div style={styles.radioGroup}>
              <button
                style={{
                  ...styles.radioButton,
                  ...(config.provider === 'openai' ? styles.radioButtonActive : {})
                }}
                onClick={() => handleProviderChange('openai')}
              >
                <span style={styles.radioLabel}>OpenAI</span>
                <span style={styles.radioDescription}>GPT-4, GPT-3.5</span>
              </button>
              <button
                style={{
                  ...styles.radioButton,
                  ...(config.provider === 'anthropic' ? styles.radioButtonActive : {})
                }}
                onClick={() => handleProviderChange('anthropic')}
              >
                <span style={styles.radioLabel}>Anthropic</span>
                <span style={styles.radioDescription}>Claude 3</span>
              </button>
            </div>
          </div>

          {/* API Key */}
          <div style={styles.field}>
            <label style={styles.label}>API Key</label>
            <div style={styles.apiKeyContainer}>
              <input
                type={showApiKey ? 'text' : 'password'}
                style={styles.input}
                value={showApiKey ? config.apiKey : (config.apiKey ? maskApiKey(config.apiKey) : '')}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder={`Enter your ${config.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                onFocus={() => setShowApiKey(true)}
                onBlur={() => setShowApiKey(false)}
              />
            </div>
            <p style={styles.hint}>
              Your API key is stored securely in VS Code's secret storage.
            </p>
          </div>

          {/* Model Selection */}
          <div style={styles.field}>
            <label style={styles.label}>Model</label>
            <select
              style={styles.select}
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
            >
              {MODELS[config.provider].map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Divider */}
        <div style={styles.divider} />

        {/* About Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>About Voya</h2>
          <p style={styles.sectionDescription}>
            Voya transforms your code into interactive, step-by-step visual walkthroughs 
            with AI-powered explanations at multiple detail levels.
          </p>
          <div style={styles.featureList}>
            <div style={styles.feature}>
              <span style={styles.featureDot} />
              <span>Dynamic detail levels from TL;DR to extreme detail</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureDot} />
              <span>Teleprompter-style auto-scrolling explanations</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureDot} />
              <span>Multi-language support for explanations</span>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button
          style={{
            ...styles.saveButton,
            ...(saved ? styles.saveButtonSuccess : {})
          }}
          onClick={handleSave}
          disabled={!config.apiKey}
        >
          {saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-foreground)'
  },
  loadingText: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--vscode-descriptionForeground)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderBottom: '1px solid var(--vscode-widget-border)'
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--vscode-textLink-foreground)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '4px 0'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 20px'
  },
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    color: 'var(--vscode-foreground)'
  },
  sectionDescription: {
    fontSize: '13px',
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '20px',
    lineHeight: '1.5'
  },
  field: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--vscode-foreground)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  radioGroup: {
    display: 'flex',
    gap: '12px'
  },
  radioButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '14px 16px',
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s'
  },
  radioButtonActive: {
    borderColor: 'var(--vscode-focusBorder)',
    backgroundColor: 'var(--vscode-list-hoverBackground)'
  },
  radioLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--vscode-foreground)'
  },
  radioDescription: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)',
    marginTop: '4px'
  },
  apiKeyContainer: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    fontFamily: 'var(--vscode-editor-font-family)',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s'
  },
  hint: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)',
    marginTop: '8px'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '6px',
    outline: 'none',
    cursor: 'pointer'
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--vscode-widget-border)',
    margin: '8px 0 32px 0'
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
    color: 'var(--vscode-foreground)'
  },
  featureDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--vscode-textLink-foreground)',
    flexShrink: 0
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid var(--vscode-widget-border)'
  },
  saveButton: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--vscode-button-foreground)',
    backgroundColor: 'var(--vscode-button-background)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  saveButtonSuccess: {
    backgroundColor: 'var(--vscode-testing-iconPassed)'
  }
};

export default Settings;
