export const ELEMENT_ICON_PATHS = {
  pyro: 'M32 4c4 10-6 14-6 22 0 6 5 10 10 10s10-5 10-11c6 4 8 11 8 17 0 12-10 22-22 22S10 54 10 42c0-14 14-18 22-38z',
  hydro: 'M32 4c10 16 18 26 18 38a18 18 0 11-36 0c0-12 8-22 18-38z',
  cryo: 'M32 6v52M12 16l40 32M52 16L12 48M32 6l-8 8m8-8l8 8M32 58l-8-8m8 8l8-8M12 16l10 2m-10-2l2 10M52 16l-10 2m10-2l-2 10M12 48l10-2m-10 2l2-10M52 48l-10-2m10 2l-2-10',
  electro: 'M36 4L14 36h14l-6 24 26-34H34z',
  anemo: 'M8 24a14 14 0 1114 14H10M14 44a10 10 0 109-15H8M30 8a8 8 0 118 8H10',
  geo: 'M32 4l26 46H6zM32 20l14 24H18z',
  dendro: 'M32 6C16 10 8 24 8 38c8 4 18 2 24-6-2 10-2 18 0 26 2-8 2-16 0-26 6 8 16 10 24 6 0-14-8-28-24-32z',
};
export function ElementIcon({ element, size = 28, className = '', style }) {
  const d = ELEMENT_ICON_PATHS[element];
  if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
}
