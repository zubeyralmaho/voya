import React from 'react';
import { VoyaTour } from '../../../src/core/types';

interface TourListProps {
  tours: VoyaTour[];
  onSelectTour: (tourId: string) => void;
  onOpenSettings: () => void;
  onOpenJournal: () => void;
}

const TourList: React.FC<TourListProps> = ({ tours, onSelectTour, onOpenSettings, onOpenJournal }) => {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.brand}>
            <h1 style={styles.title}>Voya</h1>
            <span style={styles.badge}>beta</span>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.headerButton} onClick={onOpenJournal}>
              Journal
            </button>
            <button style={styles.headerButton} onClick={onOpenSettings}>
              Settings
            </button>
          </div>
        </div>
        <p style={styles.subtitle}>Interactive Code Tours</p>
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Content */}
      {tours.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No tours yet</p>
          <p style={styles.emptyHint}>
            Select code and run "Voya: Create Tour" to get started
          </p>
        </div>
      ) : (
        <div style={styles.tourList}>
          <div style={styles.sectionLabel}>Your Tours</div>
          {tours.map(tour => (
            <button
              key={tour.id}
              style={styles.tourCard}
              onClick={() => onSelectTour(tour.id)}
            >
              <div style={styles.tourTitle}>{tour.title}</div>
              <div style={styles.tourMeta}>
                {tour.steps.length} steps · {formatDate(tour.createdAt)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    backgroundColor: 'var(--vscode-editor-background)'
  },
  header: {
    marginBottom: '16px'
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
    color: 'var(--vscode-foreground)'
  },
  badge: {
    fontSize: '10px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)'
  },
  headerActions: {
    display: 'flex',
    gap: '8px'
  },
  headerButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--vscode-textLink-foreground)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '4px 8px'
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--vscode-descriptionForeground)',
    margin: 0
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--vscode-widget-border)',
    marginBottom: '20px'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--vscode-foreground)',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '13px',
    color: 'var(--vscode-descriptionForeground)',
    maxWidth: '280px',
    lineHeight: '1.5'
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '12px'
  },
  tourList: {
    display: 'flex',
    flexDirection: 'column'
  },
  tourCard: {
    background: 'transparent',
    border: '1px solid var(--vscode-widget-border)',
    borderRadius: '6px',
    padding: '14px 16px',
    marginBottom: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s, border-color 0.15s',
    color: 'var(--vscode-foreground)'
  },
  tourTitle: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px'
  },
  tourMeta: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  }
};

export default TourList;
