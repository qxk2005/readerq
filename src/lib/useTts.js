'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createTtsManager } from '@/lib/tts';

/**
 * React Hook: TTS 朗读状态管理
 * 提供 ttsState, startTts, toggleTts, nextChunk, previousChunk, stopTts
 */
export function useTts() {
  const managerRef = useRef(null);
  const [ttsState, setTtsState] = useState({
    isActive: false,
    isPlaying: false,
    progress: 0,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
    currentChunkText: null,
    currentElement: null,
  });

  useEffect(() => {
    const manager = createTtsManager();
    managerRef.current = manager;
    
    const unsubscribe = manager.subscribe((newState) => {
      setTtsState({ ...newState });
    });

    return () => {
      unsubscribe();
      manager.shutdown();
    };
  }, []);

  const startTts = useCallback((htmlContent) => {
    managerRef.current?.speak(htmlContent);
  }, []);

  const startTtsFromDom = useCallback((articleElement) => {
    managerRef.current?.speakFromDom(articleElement);
  }, []);

  const toggleTts = useCallback(() => {
    managerRef.current?.togglePlayPause();
  }, []);

  const nextChunk = useCallback(() => {
    managerRef.current?.nextChunk();
  }, []);

  const previousChunk = useCallback(() => {
    managerRef.current?.previousChunk();
  }, []);

  const stopTts = useCallback(() => {
    managerRef.current?.stop();
  }, []);

  return {
    ttsState,
    startTts,
    startTtsFromDom,
    toggleTts,
    nextChunk,
    previousChunk,
    stopTts,
  };
}
