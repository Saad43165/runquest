export const palette = {
  bg: '#F3F6FC',
  card: '#FFFFFF',
  text: '#5B6579',
  white: '#FFFFFF',
  accent: '#3A86FF',
  muted: '#E6ECF7',
  darkText: '#111827',
};

export const spacing = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 20,
};

export function setPaletteForTheme(name: 'light' | 'midnight' | 'aurora' | 'sunset') {
  if (name === 'light') {
    palette.bg = '#F3F6FC';
    palette.card = '#FFFFFF';
    palette.text = '#5B6579';
    palette.accent = '#3A86FF';
    palette.muted = '#E6ECF7';
    palette.darkText = '#111827';
  } else if (name === 'aurora') {
    palette.bg = '#0a0f1f';
    palette.card = '#0f1d3a';
    palette.text = '#9fb3ff';
    palette.accent = '#7CFFCB';
    palette.muted = '#15264f';
    palette.darkText = '#0a0f1f';
  } else if (name === 'sunset') {
    palette.bg = '#1a0f0b';
    palette.card = '#2a1a14';
    palette.text = '#f2c7a1';
    palette.accent = '#FF7A59';
    palette.muted = '#3a241c';
    palette.darkText = '#1a0f0b';
  } else {
    palette.bg = '#0b1026';
    palette.card = '#141a33';
    palette.text = '#8a93b8';
    palette.accent = '#00D1FF';
    palette.muted = '#1f2647';
    palette.darkText = '#0b1026';
  }
}
