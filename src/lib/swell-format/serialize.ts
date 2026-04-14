import type { Song } from '../../types/song';

export const downloadSwell = (song: Song): void => {
  const blob = new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composition.swell';
  a.click();
  URL.revokeObjectURL(url);
};
