import type { Composition } from '../../types/song';

export const downloadSwell = (composition: Composition): void => {
  const blob = new Blob([JSON.stringify(composition, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composition.swell';
  a.click();
  URL.revokeObjectURL(url);
};
