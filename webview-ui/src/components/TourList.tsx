import React from 'react';
import { VoyaTour } from '../../../src/core/types';

interface TourListProps {
  tours: VoyaTour[];
  onSelectTour: (tourId: string) => void;
}

const TourList: React.FC<TourListProps> = ({ tours, onSelectTour }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 Voya</h1>
        <p style={styles.subtitle}>Interactive Code Tours</p>
      </div>

      {tours.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <p style={styles.emptyText}>No tours yet</p>
          <p style={styles.emptyHint}>
            Select some code and use "Voya: Create Tour from Selection" to get started
          </p>
        </div>
      ) : (
        <div style={styles.tourList}>
          {tours.map(tour => (
            <button
              key={tour.id}
              style={styles.tourCard}
              onClick={() => onSelectTour(tour.id)}
            >
              <div style={styles.tourTitle}>{tour.title}</div>
              <div style={styles.tourMeta}>
                {tour.steps.length} steps • {formatDate(tour.createdAt)}
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
    padding: '20px'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: 'var(--vscode-foreground)'
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--vscode-descriptionForeground)'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '18px',
    color: 'var(--vscode-foreground)',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '13px',
    color: 'var(--vscode-descriptionForeground)',
    maxWidth: '300px'
  },
  tourList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  tourCard: {
    background: 'var(--vscode-button-secondaryBackground)',
    border: '1px solid var(--vscode-widget-border)',
    borderRadius: '6px',
    padding: '16px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s',
    color: 'var(--vscode-foreground)'
  },
  tourTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '4px'
  },
  tourMeta: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  }
};

export default TourList;
