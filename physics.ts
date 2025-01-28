import protobuf from 'protobufjs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { type Player } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log("Physics process started");

try {
  const root = await protobuf.load(join(__dirname, "proto", "game.proto"));
  const GameState = root.lookupType("GameState");

  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    
    try {
      const message = GameState.decode(buffer);
      const state = GameState.toObject(message);
      buffer = Buffer.alloc(0);
      
      const updatedPlayers = state.players.map((player: Player) => ({
        ...player,
        x: player.x + (Math.random() - 0.5) * 10,
        y: player.y + (Math.random() - 0.5) * 10,
        velocity: {
          x: (Math.random() - 0.5) * 5,
          y: (Math.random() - 0.5) * 5
        }
      }));
      
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
  });
} catch (err) {
  console.error("Error in physics process:", err);
}
