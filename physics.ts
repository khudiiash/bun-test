import protobuf from 'protobufjs';
import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Player, GameState as GameStateType } from './types.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("Physics process starting");

// Physics constants
const TIMESTEP = 1/60;
const DRAG = 0.98;
const MAX_SPEED = 200;
const MAX_FORCE = 500;
const BOUNDARY_SIZE = 500;
const REPULSION_RADIUS = 30;
const REPULSION_STRENGTH = 100;

let GameState: protobuf.Type;
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;

// Load protobuf schema
const root = await protobuf.load(join(__dirname, "proto", "game.proto"));
GameState = root.lookupType("GameState");
connect();

function updatePhysics(player: Player, allPlayers: Player[]): Player {
  // Calculate distances to other players
  let totalForceX = 0;
  let totalForceY = 0;
  
  for (const other of allPlayers) {
    if (other.id === player.id) continue;
    
    const dx = player.x - other.x;
    const dy = player.y - other.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq > 0 && distSq < REPULSION_RADIUS * REPULSION_RADIUS) {
      const dist = Math.sqrt(distSq);
      const force = REPULSION_STRENGTH * (1 - dist / REPULSION_RADIUS);
      totalForceX += dx / dist * force;
      totalForceY += dy / dist * force;
    }
  }
  
  // Add random movement force
  totalForceX += (Math.random() - 0.5) * MAX_FORCE;
  totalForceY += (Math.random() - 0.5) * MAX_FORCE;
  
  // Update velocity with forces and drag
  let newVelX = player.velocity.x * DRAG + totalForceX * TIMESTEP;
  let newVelY = player.velocity.y * DRAG + totalForceY * TIMESTEP;
  
  // Clamp velocity to max speed
  const speedSq = newVelX * newVelX + newVelY * newVelY;
  if (speedSq > MAX_SPEED * MAX_SPEED) {
    const scale = MAX_SPEED / Math.sqrt(speedSq);
    newVelX *= scale;
    newVelY *= scale;
  }
  
  // Update position
  let newX = player.x + newVelX * TIMESTEP;
  let newY = player.y + newVelY * TIMESTEP;
  
  // Bounce off boundaries
  if (Math.abs(newX) > BOUNDARY_SIZE) {
    newX = Math.sign(newX) * BOUNDARY_SIZE;
    newVelX *= -0.8;
  }
  if (Math.abs(newY) > BOUNDARY_SIZE) {
    newY = Math.sign(newY) * BOUNDARY_SIZE;
    newVelY *= -0.8;
  }
  
  return {
    ...player,
    x: newX,
    y: newY,
    velocity: { x: newVelX, y: newVelY }
  };
}

// Performance monitoring
let frameCount = 0;
let lastPhysicsTime = 0;
let lastFPSUpdate = performance.now();

async function connect(): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  try {
    console.log("Attempting to connect to main process...");
    
    ws = new WebSocket("ws://localhost:8081", {
      perMessageDeflate: false
    });

    ws.on("open", () => {
      console.log("Connected to main process");
      isConnecting = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    ws.on("message", (data: Buffer) => {
      try {
        const startTime = performance.now();
        
        const message = GameState.decode(data);
        const state = GameState.toObject(message) as GameStateType;
        
        // Update physics for all players
        const updatedPlayers = state.players.map(player => 
          updatePhysics(player, state.players)
        );

        // Send back updated state
        const updatedState = { players: updatedPlayers };
        const updatedMessage = GameState.create(updatedState);
        const buffer = GameState.encode(updatedMessage).finish();
        
        // Performance monitoring
        const endTime = performance.now();
        lastPhysicsTime = endTime - startTime;
        frameCount++;
        
        if (endTime - lastFPSUpdate > 1000) {
          console.log(`Physics FPS: ${Math.round(frameCount * 1000 / (endTime - lastFPSUpdate))}`);
          console.log(`Physics time: ${Math.round(lastPhysicsTime)}ms`);
          frameCount = 0;
          lastFPSUpdate = endTime;
        }
        
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(buffer);
        }
      } catch (err) {
        console.error("Decode error:", err);
      }
    });

    ws.on("close", () => {
      console.log("Disconnected from main process");
      isConnecting = false;
      ws = null;
      // Try to reconnect after a delay
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(connect, 1000);
      }
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      if (ws) {
        ws.close();
      }
    });
  } catch (error) {
    console.error("Connection error:", error);
    isConnecting = false;
    if (!reconnectTimeout) {
      reconnectTimeout = setTimeout(connect, 1000);
    }
  }
}

// Start initial connection attempt at startup
console.log("Physics process ready");

// Handle process exit
process.on("exit", () => {
  console.log("Physics process exiting");
  if (ws) {
    ws.close();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
});

// Handle SIGINT
process.on("SIGINT", () => {
  console.log("Physics process received SIGINT");
  if (ws) {
    ws.close();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  process.exit(0);
});