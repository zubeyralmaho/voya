import React, { useEffect, useState } from 'react';
import { VoyaTour, PlayerState, ExtensionToWebviewMessage, DetailLevel, StepExplanations } from '../../src/core/types';
import { vscode } from './vscodeApi';
import Player from './components/Player';
import TourList from './components/TourList';
import Settings from './components/Settings';

type ViewState = 'list' | 'settings' | 'player';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('list');
  const [tours, setTours] = useState<VoyaTour[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    activeTourId: null,
    currentStepIndex: 0,
    isPlaying: false,
    playbackSpeed: 1.0,
    isLoadingDeepen: false,
    preferences: {
      language: 'en',
      detailLevel: 'general'
    }
  });
  const [activeTour, setActiveTour] = useState<VoyaTour | null>(null);
  // Cache for deepened explanations (per step, per level)
  const [deepenedExplanations, setDeepenedExplanations] = useState<Record<number, StepExplanations>>({});

  useEffect(() => {
    // Request tour list on mount
    vscode.postMessage({ type: 'requestTourList' });

    // Listen for messages from extension
    const unsubscribe = vscode.onMessage((message: ExtensionToWebviewMessage) => {
      switch (message.type) {
        case 'tourList':
          setTours(message.tours);
          break;
        case 'tourLoaded':
          setActiveTour(message.tour);
          setDeepenedExplanations({}); // Reset cache for new tour
          setPlayerState(prev => ({
            ...prev,
            activeTourId: message.tour.id,
            currentStepIndex: 0,
            isPlaying: false,
            isLoadingDeepen: false
          }));
          break;
        case 'stepChanged':
          setPlayerState(prev => ({
            ...prev,
            currentStepIndex: message.stepIndex
          }));
          break;
        case 'playbackStateChanged':
          setPlayerState(prev => ({
            ...prev,
            isPlaying: message.isPlaying
          }));
          break;
        case 'deepenStarted':
          setPlayerState(prev => ({
            ...prev,
            isLoadingDeepen: true
          }));
          break;
        case 'deepenComplete':
          setPlayerState(prev => ({
            ...prev,
            isLoadingDeepen: false
          }));
          // Cache the deepened explanation
          setDeepenedExplanations(prev => ({
            ...prev,
            [message.stepIndex]: {
              ...prev[message.stepIndex],
              [message.detailLevel]: message.explanation
            }
          }));
          break;
        case 'error':
          setPlayerState(prev => ({
            ...prev,
            isLoadingDeepen: false
          }));
          console.error('Extension error:', message.message);
          break;
      }
    });

    return unsubscribe;
  }, []);

  const handleSelectTour = (tourId: string) => {
    vscode.postMessage({ type: 'loadTour', tourId });
    setView('player');
  };

  const handlePlay = () => vscode.postMessage({ type: 'play' });
  const handlePause = () => vscode.postMessage({ type: 'pause' });
  const handleNext = () => vscode.postMessage({ type: 'nextStep' });
  const handlePrev = () => vscode.postMessage({ type: 'prevStep' });
  const handleGoToStep = (index: number) => vscode.postMessage({ type: 'goToStep', stepIndex: index });
  
  const handleDetailLevelChange = (level: DetailLevel) => {
    setPlayerState(prev => ({
      ...prev,
      preferences: { ...prev.preferences, detailLevel: level }
    }));
    vscode.postMessage({ type: 'setDetailLevel', level });
  };

  const handleRequestDeepen = (targetLevel: DetailLevel) => {
    vscode.postMessage({ 
      type: 'requestDeepen', 
      stepIndex: playerState.currentStepIndex, 
      targetLevel 
    });
  };

  // Get the current explanation based on detail level
  const getCurrentExplanation = (): string => {
    if (!activeTour) return '';
    
    const step = activeTour.steps[playerState.currentStepIndex];
    if (!step) return '';

    const level = playerState.preferences.detailLevel;
    
    // Check deepened cache first
    const cached = deepenedExplanations[playerState.currentStepIndex]?.[level];
    if (cached) return cached;

    // Check tour's embedded explanations
    if (step.content.explanations?.[level]) {
      return step.content.explanations[level]!;
    }

    // Fall back to default explanation
    return step.content.explanation;
  };

  if (view === 'settings') {
    return (
      <Settings 
        onBack={() => setView('list')}
        vscode={vscode}
      />
    );
  }

  if (view === 'player' && activeTour) {
    return (
      <Player
        tour={activeTour}
        currentStepIndex={playerState.currentStepIndex}
        isPlaying={playerState.isPlaying}
        playbackSpeed={playerState.playbackSpeed}
        detailLevel={playerState.preferences.detailLevel}
        isLoadingDeepen={playerState.isLoadingDeepen}
        currentExplanation={getCurrentExplanation()}
        onPlay={handlePlay}
        onPause={handlePause}
        onNext={handleNext}
        onPrev={handlePrev}
        onGoToStep={handleGoToStep}
        onBack={() => {
          setActiveTour(null);
          setView('list');
        }}
        onDetailLevelChange={handleDetailLevelChange}
        onRequestDeepen={handleRequestDeepen}
      />
    );
  }

  return (
    <TourList 
      tours={tours} 
      onSelectTour={handleSelectTour}
      onOpenSettings={() => setView('settings')}
    />
  );
};

export default App;
