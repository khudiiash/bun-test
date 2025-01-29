import protobuf from 'protobufjs';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { join } from 'path';
import { Player, GameState as GameStateType } from './types.js';

console.log("Main process starting");

// Start WebSocket server
const wss = new WebSocketServer({ 
  port: 8081,
  perMessageDeflate: false,
  clientTracking: true
});


// Load protobuf schema
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = await protobuf.load(join(__dirname, "proto", "game.proto"));
const GameState = root.lookupType("GameState");

function startServer(): void {
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
  const physicsProcess = spawn('node', ['physics.js'], {
    cwd: __dirname,
    stdio: ['inherit', 'inherit', 'inherit']
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

  let updateInterval: NodeJS.Timeout | null = null;

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket) => {
    console.log("Physics process connected");

    // Clear any existing interval
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    // Send state updates
    const sendUpdate = (): void => {
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
    ws.on("message", (data: Buffer) => {
      try {
        const message = GameState.decode(data);
        const state = GameState.toObject(message) as GameStateType;
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

    ws.on("error", (error: Error) => {
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
}

startServer();