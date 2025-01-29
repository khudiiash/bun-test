import * as protobuf from "protobufjs";
import { type Player } from "./types.ts";
import { join } from "path";
import { WebSocketServer } from "ws";

console.log("Main process starting");

// Start WebSocket server
const wss = new WebSocketServer({ 
  port: 8081,
  perMessageDeflate: false,
  clientTracking: true
});

// Load protobuf schema
const root = await protobuf.load(join(import.meta.dir, "proto", "game.proto"));
const GameState = root.lookupType("GameState");

// Initialize 100 players in a grid pattern
const PLAYER_COUNT = 100;
const GRID_SIZE = Math.ceil(Math.sqrt(PLAYER_COUNT));
const SPACING = 50;

const players: Player[] = Array.from({ length: PLAYER_COUNT }, (_, index) => ({
  id: index,
  x: (index % GRID_SIZE) * SPACING - (GRID_SIZE * SPACING / 2),
  y: Math.floor(index / GRID_SIZE) * SPACING - (GRID_SIZE * SPACING / 2),
  velocity: { x: 0, y: 0 }
}));

console.log("WebSocket server started on port 8081");

// Spawn physics process
const physicsProcess = Bun.spawn(["bun", "physics.ts"], {
  cwd: import.meta.dir,
  stdio: ["inherit", "inherit", "inherit"],
});

if (!physicsProcess.pid) {
  console.error("Failed to start physics process");
  process.exit(1);
}

console.log("Physics process started with PID:", physicsProcess.pid);

// Performance monitoring
let lastTime = performance.now();
let frameCount = 0;
let lastFPSUpdate = performance.now();

let updateInterval: NodeJS.Timer | null = null;

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("Physics process connected");

  // Clear any existing interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  // Send state updates
  const sendUpdate = () => {
    try {
      const message = GameState.create({ players });
      const buffer = GameState.encode(message).finish();
      
      // Calculate update time
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      
      // Update FPS counter every second
      frameCount++;
      if (now - lastFPSUpdate > 1000) {
        console.log(`FPS: ${Math.round(frameCount * 1000 / (now - lastFPSUpdate))}`);
        frameCount = 0;
        lastFPSUpdate = now;
      }
      
      if (ws.readyState === ws.OPEN) {
        ws.send(buffer);
      }
    } catch (err) {
      console.error("Error sending state:", err);
    }
  };

  // Handle messages from physics process
  ws.on("message", (data) => {
    try {
      const message = GameState.decode(data);
      const state = GameState.toObject(message);
      // Update our players array with the new state
      players.splice(0, players.length, ...state.players);
    } catch (err) {
      console.error("Decode error:", err);
    }
  });

  // Send updates at 60 FPS
  updateInterval = setInterval(sendUpdate, 1000/60);

  ws.on("close", () => {
    console.log("Physics process disconnected");
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// Clean up on exit
process.on("SIGINT", () => {
  console.log("Main process exiting");
  wss.close();
  physicsProcess.kill();
  process.exit(0);
});

process.on("exit", () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  wss.close();
  physicsProcess.kill();
});