export interface WordEntity {
  id: string;
  text: string;
  x: number; // Percentage (0-100)
  y: number; // Percentage (0-100)
  speed: number;
  color: string;
}

export interface Particle {
  id: string;
  x: number; // Percentage
  y: number; // Percentage
  vx: number;
  vy: number;
  life: number; // 0-1 opacity/life
  color: string;
  size: number;
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface GameSettings {
  spawnRate: number; // ms between spawns
  baseSpeed: number;
}