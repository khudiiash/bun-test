import * as protobuf from "protobufjs";
import { type Player} from "./types.ts";
import { join } from "path";

console.log("Physics process started");

// Load protobuf schema
const root = await protobuf.load(join(import.meta.dir, "proto", "game.proto"));
const GameState = root.lookupType("GameState");

let buffer = Buffer.alloc(0);

(async () => {
  for await (const chunk of process.stdin) {
    buffer = Buffer.concat([buffer, chunk]);
    
    try {
      const message = GameState.decode(buffer);
      const state = GameState.toObject(message);
      buffer = Buffer.alloc(0);
      
      // Update physics (just random changes for demo)
      const updatedPlayers = state.players.map((player: Player) => ({
        ...player,
        x: player.x + (Math.random() - 0.5) * 10,
        y: player.y + (Math.random() - 0.5) * 10,
        velocity: {
          x: (Math.random() - 0.5) * 5,
          y: (Math.random() - 0.5) * 5
        }
      }));
      
      // Encode and send back
      const updatedState = { players: updatedPlayers };
      const updatedMessage = GameState.create(updatedState);
      const updatedBuffer = GameState.encode(updatedMessage).finish();
      
      process.stdout.write(updatedBuffer);
    } catch (err) {
      if (!(err instanceof protobuf.util.ProtocolError)) {
        console.error("Error processing input:", err);
        buffer = Buffer.alloc(0);
      }
    }
  }
})();