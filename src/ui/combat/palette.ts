/** Colour constants for the 2D combat renderer. Dusk-battlefield mood. */

export const SKY = {
  top: '#241a3a',
  mid: '#5b3a6b',
  low: '#c9663e',
  horizon: '#f2a25c',
};

export const HILLS_FAR = '#3a2c53';
export const HILLS_NEAR = '#2b2140';

export const GROUND_TOP = '#3e6b3a';
export const GROUND = '#243a24';
export const GROUND_DARK = '#182818';
export const GROUND_TUFT = '#4c7a44';

export const TEAM = {
  ally: { hp: '#5ad17a', ring: '#bfe9ff', shadow: 'rgba(120,170,255,0.25)' },
  enemy: { hp: '#ff6b6b', ring: '#ffd0c0', shadow: 'rgba(255,120,120,0.22)' },
};

/** Per-kind base tints (skin/cloth/metal) used by the sprite drawers. */
export const KIND: Record<string, { a: string; b: string; c: string }> = {
  warrior: { a: '#7c8aa8', b: '#4a5570', c: '#d8b25a' }, // steel / dark steel / gold trim
  mage: { a: '#4d6cc4', b: '#2f3f86', c: '#ffe08a' }, // robe / dark robe / orb
  priest: { a: '#e8e2d0', b: '#c9b98c', c: '#ffe9a8' },
  rogue: { a: '#5b6b58', b: '#33402f', c: '#9fd07a' },
  goblin: { a: '#7fae5a', b: '#5c8140', c: '#b08a5a' }, // green skin / dark / club wood
  archer: { a: '#8fbf6a', b: '#5c8140', c: '#caa96a' },
  orc: { a: '#6f8f6a', b: '#3f5540', c: '#9aa0a6' }, // grey-green / dark / axe steel
  ogre: { a: '#9aac74', b: '#5f6f45', c: '#8a6b45' },
};

export const PROJECTILE = {
  mageCore: '#ffffff',
  mageGlow: '#7fb0ff',
  arrow: '#e8d9b0',
};

export const TEXT = {
  damage: '#ffffff',
  crit: '#ffd93d',
  heal: '#7ef2a8',
  outline: 'rgba(0,0,0,0.65)',
};
