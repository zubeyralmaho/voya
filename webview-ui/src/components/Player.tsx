import React, { useEffect, useRef, useState } from 'react';
import { VoyaTour, DetailLevel, DETAIL_LEVEL_META } from '../../../src/core/types';

interface PlayerProps {
  tour: VoyaTour;
  currentStepIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  detailLevel: DetailLevel;
  isLoadingDeepen: boolean;
  currentExplanation: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onGoToStep: (index: number) => void;
  onBack: () => void;
  onDetailLevelChange: (level: DetailLevel) => void;
  onRequestDeepen: (targetLevel: DetailLevel) => void;
}

const DETAIL_LEVELS: DetailLevel[] = ['tldr', 'general', 'detailed', 'extreme_detail'];

const Player: React.FC<PlayerProps> = ({
  tour,
  currentStepIndex,
  isPlaying,
  playbackSpeed,
  detailLevel,
  isLoadingDeepen,
  currentExplanation,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onGoToStep,
  onBack,
  onDetailLevelChange,
  onRequestDeepen
}) => {
  const currentStep = tour.steps[currentStepIndex];
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showDetailSelector, setShowDetailSelector] = useState(false);

  // Auto-scroll teleprompter when playing
  useEffect(() => {
    if (!isPlaying || !teleprompterRef.current) return;

    const element = teleprompterRef.current;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    
    if (scrollHeight <= 0) {
      // No scrolling needed, auto-advance after delay
      const timer = setTimeout(() => {
        if (currentStepIndex < tour.steps.length - 1) {
          onNext();
        } else {
          onPause();
        }
      }, 3000 / playbackSpeed);
      return () => clearTimeout(timer);
    }

    const scrollSpeed = 30 * playbackSpeed; // pixels per second
    const duration = (scrollHeight / scrollSpeed) * 1000;
    const startTime = Date.now();
    const startScroll = element.scrollTop;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      element.scrollTop = startScroll + (scrollHeight * progress);
      setScrollProgress(progress * 100);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Auto-advance to next step
        setTimeout(() => {
          if (currentStepIndex < tour.steps.length - 1) {
            onNext();
          } else {
            onPause();
          }
        }, 1000);
      }
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, currentStepIndex, playbackSpeed, tour.steps.length, onNext, onPause]);

  // Reset scroll when step changes or explanation changes
  useEffect(() => {
    if (teleprompterRef.current) {
      teleprompterRef.current.scrollTop = 0;
      setScrollProgress(0);
    }
  }, [currentStepIndex, currentExplanation]);

  // Get the next deeper level
  const getNextDeeperLevel = (): DetailLevel | null => {
    const currentIndex = DETAIL_LEVELS.indexOf(detailLevel);
    if (currentIndex < DETAIL_LEVELS.length - 1) {
      return DETAIL_LEVELS[currentIndex + 1];
    }
    return null;
  };

  const nextDeeperLevel = getNextDeeperLevel();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <div style={styles.tourInfo}>
          <div style={styles.tourTitle}>{tour.title}</div>
          <div style={styles.stepIndicator}>
            Step {currentStepIndex + 1} of {tour.steps.length}
          </div>
        </div>
      </div>

      {/* Detail Level Selector */}
      <div style={styles.detailLevelContainer}>
        <button 
          style={styles.detailLevelButton}
          onClick={() => setShowDetailSelector(!showDetailSelector)}
        >
          <span style={styles.detailLevelIcon}>📊</span>
          {DETAIL_LEVEL_META[detailLevel].label}
          <span style={styles.dropdownArrow}>{showDetailSelector ? '▲' : '▼'}</span>
        </button>
        
        {showDetailSelector && (
          <div style={styles.detailLevelDropdown}>
            {DETAIL_LEVELS.map((level) => (
              <button
                key={level}
                style={{
                  ...styles.detailLevelOption,
                  backgroundColor: level === detailLevel 
                    ? 'var(--vscode-list-activeSelectionBackground)' 
                    : 'transparent'
                }}
                onClick={() => {
                  onDetailLevelChange(level);
                  onRequestDeepen(level); // Request explanation at this level
                  setShowDetailSelector(false);
                }}
              >
                <div style={styles.optionLabel}>{DETAIL_LEVEL_META[level].label}</div>
                <div style={styles.optionDescription}>{DETAIL_LEVEL_META[level].description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressTrack}>
          {tour.steps.map((_, index) => (
            <button
              key={index}
              style={{
                ...styles.progressDot,
                backgroundColor: index === currentStepIndex 
                  ? 'var(--vscode-button-background)' 
                  : index < currentStepIndex
                    ? 'var(--vscode-button-secondaryBackground)'
                    : 'var(--vscode-widget-border)'
              }}
              onClick={() => onGoToStep(index)}
            />
          ))}
        </div>
        {isPlaying && (
          <div style={styles.scrollProgress}>
            <div 
              style={{
                ...styles.scrollProgressBar,
                width: `${scrollProgress}%`
              }} 
            />
          </div>
        )}
      </div>

      {/* Step Summary */}
      <div style={styles.stepSummary}>
        <span style={styles.stepIcon}>📍</span>
        {currentStep?.content.summary || 'Loading...'}
      </div>

      {/* File Info */}
      <div style={styles.fileInfo}>
        <span style={styles.fileIcon}>📄</span>
        {currentStep?.filePath}
        <span style={styles.lineRange}>
          Lines {currentStep?.range.startLine}-{currentStep?.range.endLine}
        </span>
      </div>

      {/* Teleprompter */}
      <div style={styles.teleprompterContainer}>
        {isLoadingDeepen && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner}>⏳</div>
            <div style={styles.loadingText}>Generating deeper analysis...</div>
          </div>
        )}
        <div 
          ref={teleprompterRef}
          style={{
            ...styles.teleprompter,
            opacity: isLoadingDeepen ? 0.3 : 1
          }}
        >
          <div style={styles.teleprompterContent}>
            {currentExplanation || 'No explanation available.'}
          </div>
        </div>
        <div style={styles.teleprompterFadeTop} />
        <div style={styles.teleprompterFadeBottom} />
      </div>

      {/* Deepen Button - Only show when not at max detail and not playing */}
      {nextDeeperLevel && !isPlaying && !isLoadingDeepen && (
        <button 
          style={styles.deepenButton}
          onClick={() => onRequestDeepen(nextDeeperLevel)}
        >
          <span style={styles.deepenIcon}>🔍</span>
          Deepen to {DETAIL_LEVEL_META[nextDeeperLevel].label}
        </button>
      )}

      {/* Controls */}
      <div style={styles.controls}>
        <button 
          style={styles.controlButton} 
          onClick={onPrev}
          disabled={currentStepIndex === 0}
        >
          ⏮ Prev
        </button>
        
        <button 
          style={styles.playButton}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        
        <button 
          style={styles.controlButton}
          onClick={onNext}
          disabled={currentStepIndex === tour.steps.length - 1}
        >
          Next ⏭
        </button>
      </div>

      {/* Speed Control */}
      <div style={styles.speedControl}>
        <span style={styles.speedLabel}>Speed: {playbackSpeed}x</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--vscode-textLink-foreground)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '4px 8px'
  },
  tourInfo: {
    flex: 1
  },
  tourTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--vscode-foreground)'
  },
  stepIndicator: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  },
  progressContainer: {
    marginBottom: '16px'
  },
  progressTrack: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '8px'
  },
  progressDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  scrollProgress: {
    height: '2px',
    backgroundColor: 'var(--vscode-widget-border)',
    borderRadius: '1px',
    overflow: 'hidden'
  },
  scrollProgressBar: {
    height: '100%',
    backgroundColor: 'var(--vscode-button-background)',
    transition: 'width 0.1s linear'
  },
  stepSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--vscode-foreground)',
    marginBottom: '8px'
  },
  stepIcon: {
    fontSize: '16px'
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '16px',
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-textBlockQuote-background)',
    borderRadius: '4px'
  },
  fileIcon: {
    fontSize: '14px'
  },
  lineRange: {
    marginLeft: 'auto',
    fontFamily: 'var(--vscode-editor-font-family)'
  },
  teleprompterContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: '16px'
  },
  teleprompter: {
    height: '100%',
    overflowY: 'auto',
    padding: '20px 16px',
    scrollBehavior: 'smooth'
  },
  teleprompterContent: {
    fontSize: '16px',
    lineHeight: '1.8',
    color: 'var(--vscode-foreground)'
  },
  teleprompterFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30px',
    background: 'linear-gradient(to bottom, var(--vscode-editor-background), transparent)',
    pointerEvents: 'none'
  },
  teleprompterFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30px',
    background: 'linear-gradient(to top, var(--vscode-editor-background), transparent)',
    pointerEvents: 'none'
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },
  controlButton: {
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  playButton: {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  speedControl: {
    textAlign: 'center'
  },
  speedLabel: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  },
  // Detail Level Selector Styles
  detailLevelContainer: {
    position: 'relative',
    marginBottom: '12px'
  },
  detailLevelButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '4px',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    fontSize: '13px'
  },
  detailLevelIcon: {
    fontSize: '14px'
  },
  dropdownArrow: {
    marginLeft: 'auto',
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)'
  },
  detailLevelDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    marginTop: '4px',
    background: 'var(--vscode-dropdown-background)',
    border: '1px solid var(--vscode-dropdown-border)',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    overflow: 'hidden'
  },
  detailLevelOption: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'var(--vscode-foreground)'
  },
  optionLabel: {
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '2px'
  },
  optionDescription: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)'
  },
  // Deepen Button Styles
  deepenButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 16px',
    marginBottom: '12px',
    background: 'linear-gradient(135deg, var(--vscode-button-secondaryBackground), var(--vscode-button-background))',
    border: '1px solid var(--vscode-button-border)',
    borderRadius: '6px',
    color: 'var(--vscode-button-foreground)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  deepenIcon: {
    fontSize: '16px'
  },
  // Loading Overlay Styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  loadingSpinner: {
    fontSize: '32px',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  loadingText: {
    marginTop: '12px',
    fontSize: '14px',
    color: 'var(--vscode-foreground)',
    fontWeight: '500'
  }
};

export default Player;
