import * as protobuf from "protobufjs";
import { type Player} from "./types.ts";
import { join } from "path";

console.log("Starting main process");

// Load protobuf schema
const root = await protobuf.load(join(import.meta.dir, "proto", "game.proto"));
const GameState = root.lookupType("GameState");

// Initialize 10 players with random positions
const players: Player[] = Array.from({ length: 2 }, (_, i) => ({
  id: i,
  x: Math.random() * 10,
  y: Math.random() * 10,
  velocity: { x: 0, y: 0 }
}));

const physicsProcess = Bun.spawn(["bun", "run", "physics.ts"], {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});

// Handle stdout
(async () => {
  let buffer = Buffer.alloc(0);
  for await (const chunk of physicsProcess.stdout) {
    buffer = Buffer.concat([buffer, chunk]);
    try {
      const message = GameState.decode(buffer);
      const state = GameState.toObject(message);
      console.log(state);
      buffer = Buffer.alloc(0);
    } catch (err) {
      if (!(err instanceof protobuf.util.ProtocolError)) {
        console.error("Error parsing physics output:", err);
        buffer = Buffer.alloc(0);
      }
    }
  }
})();

// Handle stderr
(async () => {
  const decoder = new TextDecoder();
  for await (const chunk of physicsProcess.stderr) {
    console.error("Physics stderr:", decoder.decode(chunk));
  }
})();

// Send state updates
const initialState = { players };
setInterval(() => {
  const message = GameState.create(initialState);
  const buffer = GameState.encode(message).finish();
  physicsProcess.stdin.write(buffer);
}, 1000/60);