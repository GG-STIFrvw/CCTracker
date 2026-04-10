export const BANK_PRESETS = [
  {
    id: 'sbc',
    name: 'Security Bank (SBC)',
    color_primary: '#99c044',
    color_secondary: '#00a1d3',
  },
  {
    id: 'eastwest',
    name: 'EastWest Bank',
    color_primary: '#6d288e',
    color_secondary: '#d5e04d',
  },
  {
    id: 'bpi',
    name: 'BPI',
    color_primary: '#b11116',
    color_secondary: '#dcb91c',
  },
  {
    id: 'custom',
    name: 'Custom',
    color_primary: '#1a3a52',
    color_secondary: '#2d6a8f',
  },
]

export function getBankPreset(colorPrimary) {
  return BANK_PRESETS.find((b) => b.color_primary === colorPrimary) ?? BANK_PRESETS[3]
}
