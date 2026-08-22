export interface Theme {
  id: string;
  name: string;
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'ink',
    name: 'Ink',
    vars: {
      '--bg': '#000000',
      '--panel': '#0d0d10',
      '--panel-2': '#141419',
      '--ink': '#f5f5f7',
      '--muted': '#8b8b93',
      '--line': 'rgba(255, 255, 255, 0.1)',
      '--accent': '#ff5d73',
      '--accent-2': '#ffb454',
    },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    vars: {
      '--bg': '#130a10',
      '--panel': '#1e1119',
      '--panel-2': '#291722',
      '--ink': '#ffeaf1',
      '--muted': '#bd90a3',
      '--line': 'rgba(255, 150, 190, 0.14)',
      '--accent': '#ff5f9e',
      '--accent-2': '#ffb45f',
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    vars: {
      '--bg': '#04110d',
      '--panel': '#0a1c15',
      '--panel-2': '#102820',
      '--ink': '#e6fff4',
      '--muted': '#86b8a4',
      '--line': 'rgba(90, 220, 170, 0.14)',
      '--accent': '#2ee6a6',
      '--accent-2': '#7cf0c8',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: {
      '--bg': '#060814',
      '--panel': '#0d1224',
      '--panel-2': '#141b33',
      '--ink': '#eef0ff',
      '--muted': '#8b93c0',
      '--line': 'rgba(140, 150, 255, 0.14)',
      '--accent': '#6c8cff',
      '--accent-2': '#9fb4ff',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    vars: {
      '--bg': '#120b05',
      '--panel': '#1d130a',
      '--panel-2': '#291c10',
      '--ink': '#fff3e2',
      '--muted': '#c09a72',
      '--line': 'rgba(255, 200, 130, 0.14)',
      '--accent': '#ff9e3d',
      '--accent-2': '#ffc46b',
    },
  },
];

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}
