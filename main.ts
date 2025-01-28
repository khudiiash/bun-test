import { fork } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

console.log("Starting main process");

try {
  const root = await protobuf.load(join(__dirname, "proto", "game.proto"));
  const GameState = root.lookupType("GameState");

  const players = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 10,
    y: (Math.random() - 0.5) * 10,
    velocity: { x: 0, y: 0 }
  }));

  const physicsProcess = fork('dist/physics.js', [], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });

  console.log("Physics process spawned with PID:", physicsProcess.pid);

  physicsProcess.stdout!.on('data', (chunk: Buffer) => {
    try {
      const message = GameState.decode(chunk);
      const state = GameState.toObject(message);
      console.log("Received state update. Player[0] pos:", state.players[0].x, state.players[0].y);
    } catch (err) {
      if (!(err instanceof protobuf.util.ProtocolError)) {
        console.error("Error parsing physics output:", err);
      }
    }
  });

  physicsProcess.stderr!.on('data', (data: Buffer) => {
    console.error('Physics stderr:', data.toString());
  });

  physicsProcess.on('error', (err) => {
    console.error('Physics process error:', err);
  });

  physicsProcess.on('exit', (code) => {
    console.log('Physics process exited with code:', code);
  });

  const initialState = { players };
  setInterval(() => {
    const message = GameState.create(initialState);
    const buffer = GameState.encode(message).finish();
    physicsProcess.stdin!.write(buffer);
  }, 1000/60);

} catch (err) {
  console.error("Error in main process:", err);
}