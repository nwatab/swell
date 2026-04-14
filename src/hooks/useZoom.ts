'use client';

import { useState, useCallback } from 'react';
import { DEFAULT_CELL_W, ZOOM_STEPS } from '../components/piano-roll/layout';

export type ZoomStep = typeof ZOOM_STEPS[number];

export interface UseZoomReturn {
  cellW: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export const useZoom = (): UseZoomReturn => {
  const [cellW, setCellW] = useState<ZoomStep>(DEFAULT_CELL_W);
  const zoomIdx = ZOOM_STEPS.indexOf(cellW as ZoomStep);

  const zoomIn = useCallback(() => {
    setCellW(ZOOM_STEPS[Math.min(zoomIdx + 1, ZOOM_STEPS.length - 1)]);
  }, [zoomIdx]);

  const zoomOut = useCallback(() => {
    setCellW(ZOOM_STEPS[Math.max(zoomIdx - 1, 0)]);
  }, [zoomIdx]);

  return {
    cellW,
    zoomIn,
    zoomOut,
    canZoomIn: zoomIdx < ZOOM_STEPS.length - 1,
    canZoomOut: zoomIdx > 0,
  };
};
