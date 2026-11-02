/**
 * Which phase of her Welcome Kit journey a page is showing (src/lib/club/onboarding.ts → JOURNEY), so the one Club
 * header (ClubNav) can switch to its focused onboarding mode: the brand, a compact three-phase progress and "Save &
 * finish later". A page sets it once it knows where she is; `null` is the normal Club navigation.
 */
import { useEffect, useState } from 'react';
import type { KitStage } from './onboarding';

const EVENT = 'omc:club-journey';
let current: KitStage | null = null;

export function setJourney(stage: KitStage | null) {
  if (typeof window === 'undefined' || stage === current) return;
  current = stage;
  window.dispatchEvent(new CustomEvent<KitStage | null>(EVENT, { detail: stage }));
}

export function useJourney(): KitStage | null {
  const [stage, setStage] = useState<KitStage | null>(current);
  useEffect(() => {
    const on = (e: Event) => setStage((e as CustomEvent<KitStage | null>).detail);
    window.addEventListener(EVENT, on);
    setStage(current);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return stage;
}
