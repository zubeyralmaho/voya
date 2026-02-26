import React from 'react';
import { TrackedChange, CodeJournal } from '../../../src/core/types';

interface CodeJournalViewProps {
  journal: CodeJournal | null;
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onExplainChange: (changeId: string) => void;
  onExplainAll: () => void;
  onClearJournal: () => void;
  onGoToChange: (changeId: string) => void;
  onBack: () => void;
}

const CodeJournalView: React.FC<CodeJournalViewProps> = ({
  journal,
  isTracking,
  onStartTracking,
  onStopTracking,
  onExplainChange,
  onExplainAll,
  onClearJournal,
  onGoToChange,
  onBack
}) => {
  const changes = journal?.changes || [];
  const pendingCount = changes.filter(c => c.status === 'pending').length;
  const explainedCount = changes.filter(c => c.status === 'explained').length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusStyle = (status: TrackedChange['status']): React.CSSProperties => {
    switch (status) {
      case 'pending':
        return { color: 'var(--vscode-charts-yellow)' };
      case 'explaining':
        return { color: 'var(--vscode-charts-blue)' };
      case 'explained':
        return { color: 'var(--vscode-charts-green)' };
      case 'error':
        return { color: 'var(--vscode-errorForeground)' };
      default:
        return {};
    }
  };

  const getStatusLabel = (status: TrackedChange['status']): string => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'explaining': return 'Explaining...';
      case 'explained': return 'Explained';
      case 'error': return 'Error';
      default: return status;
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          Back
        </button>
        <h1 style={styles.title}>Code Journal</h1>
      </div>

      {/* Tracking Control */}
      <div style={styles.trackingSection}>
        <div style={styles.trackingInfo}>
          <div style={styles.trackingStatus}>
            <span 
              style={{
                ...styles.statusDot,
                backgroundColor: isTracking 
                  ? 'var(--vscode-charts-green)' 
                  : 'var(--vscode-descriptionForeground)'
              }} 
            />
            <span style={styles.statusText}>
              {isTracking ? 'Tracking active' : 'Tracking paused'}
            </span>
          </div>
          {journal && (
            <span style={styles.sessionInfo}>
              Session started {formatTime(journal.sessionStart)}
            </span>
          )}
        </div>
        <button
          style={{
            ...styles.trackingButton,
            ...(isTracking ? styles.stopButton : styles.startButton)
          }}
          onClick={isTracking ? onStopTracking : onStartTracking}
        >
          {isTracking ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Stats Bar */}
      {changes.length > 0 && (
        <div style={styles.statsBar}>
          <span style={styles.stat}>
            {changes.length} changes
          </span>
          <span style={styles.statDivider}>·</span>
          <span style={styles.stat}>
            {pendingCount} pending
          </span>
          <span style={styles.statDivider}>·</span>
          <span style={styles.stat}>
            {explainedCount} explained
          </span>
        </div>
      )}

      {/* Action Bar */}
      {pendingCount > 0 && (
        <div style={styles.actionBar}>
          <button
            style={styles.explainAllButton}
            onClick={onExplainAll}
          >
            Explain All ({pendingCount})
          </button>
          <button
            style={styles.clearButton}
            onClick={onClearJournal}
          >
            Clear
          </button>
        </div>
      )}

      {/* Divider */}
      <div style={styles.divider} />

      {/* Changes List */}
      <div style={styles.changesList}>
        {changes.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No changes detected</p>
            <p style={styles.emptyHint}>
              {isTracking 
                ? 'Code changes will appear here as you work'
                : 'Start tracking to capture code changes'}
            </p>
          </div>
        ) : (
          changes.slice().reverse().map((change) => (
            <div key={change.id} style={styles.changeCard}>
              <div style={styles.changeHeader}>
                <button 
                  style={styles.changeFile}
                  onClick={() => onGoToChange(change.id)}
                >
                  {change.filePath}
                </button>
                <span style={styles.changeTime}>
                  {formatTime(change.timestamp)}
                </span>
              </div>
              
              <div style={styles.changeMeta}>
                <span style={styles.changeLines}>
                  Lines {change.range.startLine}-{change.range.endLine}
                </span>
                <span style={styles.metaDivider}>·</span>
                <span style={getStatusStyle(change.status)}>
                  {getStatusLabel(change.status)}
                </span>
                {change.source === 'agent' && (
                  <>
                    <span style={styles.metaDivider}>·</span>
                    <span style={styles.agentBadge}>AI Generated</span>
                  </>
                )}
              </div>

              {/* Code Preview */}
              <div style={styles.codePreview}>
                <pre style={styles.codeText}>
                  {change.code.split('\n').slice(0, 4).join('\n')}
                  {change.code.split('\n').length > 4 && '\n...'}
                </pre>
              </div>

              {/* Explanation or Action */}
              {change.status === 'explained' && change.explanation ? (
                <div style={styles.explanation}>
                  {change.explanation}
                </div>
              ) : change.status === 'pending' ? (
                <button
                  style={styles.explainButton}
                  onClick={() => onExplainChange(change.id)}
                >
                  Explain
                </button>
              ) : change.status === 'explaining' ? (
                <div style={styles.loadingText}>Generating explanation...</div>
              ) : null}
            </div>
          ))
        )}
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
  trackingSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    backgroundColor: 'var(--vscode-sideBar-background)'
  },
  trackingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  trackingStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  statusText: {
    fontSize: '14px',
    fontWeight: '500'
  },
  sessionInfo: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  },
  trackingButton: {
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  startButton: {
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)'
  },
  stopButton: {
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)'
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)',
    borderBottom: '1px solid var(--vscode-widget-border)'
  },
  stat: {
    color: 'var(--vscode-foreground)'
  },
  statDivider: {
    color: 'var(--vscode-descriptionForeground)'
  },
  actionBar: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid var(--vscode-widget-border)'
  },
  explainAllButton: {
    flex: 1,
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '500',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  clearButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: 'var(--vscode-descriptionForeground)',
    border: '1px solid var(--vscode-widget-border)',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--vscode-widget-border)'
  },
  changesList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 20px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '13px',
    color: 'var(--vscode-descriptionForeground)',
    maxWidth: '280px'
  },
  changeCard: {
    marginBottom: '16px',
    padding: '14px',
    backgroundColor: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-widget-border)',
    borderRadius: '6px'
  },
  changeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  changeFile: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--vscode-textLink-foreground)',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left'
  },
  changeTime: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  },
  changeMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    fontSize: '12px'
  },
  changeLines: {
    color: 'var(--vscode-descriptionForeground)'
  },
  metaDivider: {
    color: 'var(--vscode-descriptionForeground)'
  },
  agentBadge: {
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    borderRadius: '3px'
  },
  codePreview: {
    marginBottom: '10px',
    padding: '10px 12px',
    backgroundColor: 'var(--vscode-editor-background)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  codeText: {
    margin: 0,
    fontSize: '12px',
    fontFamily: 'var(--vscode-editor-font-family)',
    color: 'var(--vscode-foreground)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  explanation: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: 'var(--vscode-foreground)',
    padding: '10px 12px',
    backgroundColor: 'var(--vscode-textBlockQuote-background)',
    borderRadius: '4px',
    borderLeft: '3px solid var(--vscode-textLink-foreground)'
  },
  explainButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  loadingText: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)',
    fontStyle: 'italic'
  }
};

export default CodeJournalView;
