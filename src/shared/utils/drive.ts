/**
 * Helper to convert a Google Drive open URL or view link to a direct viewable image URL.
 */
export const convertDriveUrlToDirectImg = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('lh3.googleusercontent.com') || trimmed.includes('images.weserv.nl')) return trimmed;
  const match = trimmed.match(/[?&]id=([^&]+)/) || trimmed.match(/\/d\/([^/]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return trimmed;
};
