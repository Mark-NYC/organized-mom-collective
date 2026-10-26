/** Preview-only shared family context. Reuses the Club store and household model, never creates an account. */
import { sampleStore } from './club/store';
import type { Household } from './club/profile';
export const appPreviewStore = () => sampleStore('rivera');
export async function appPreviewFamily(): Promise<Household | null> {
  return (await appPreviewStore()?.household()) ?? null;
}
