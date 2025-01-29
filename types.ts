export interface Vector2D {
  x: number;
  y: number;
}

export interface Player {
  id: number;
  x: number;
  y: number;
  velocity: Vector2D;
}

export interface GameState {
  players: Player[];
}