# Process Communication Demo: Bun vs Node.js

This project demonstrates and compares inter-process communication (IPC) and data streaming capabilities between Bun and Node.js runtimes. It implements a simple physics simulation where:

- Main process maintains state of 10 players
- Child process performs physics calculations
- Data is streamed between processes using Protocol Buffers for efficient serialization
- Updates happen at 60 FPS

The goal is to showcase how each runtime handles:
- Process spawning and management
- Binary data streaming
- High-frequency IPC communication
- Protocol Buffers integration

## Repository Structure

The repository has two branches:
- `bun` - Implementation using Bun runtime
- `node` - Implementation using Node.js runtime

## Prerequisites

### For Bun Version
- Bun installed: `curl -fsSL https://bun.sh/install | bash`

### For Node Version
- Node.js 18+ installed
- npm installed

## Running the Demo

### Bun Version
```bash
# Switch to Bun branch
git checkout bun

# Install dependencies
bun install

# Run the application
npm start
```

### Node Version
```bash
# Switch to Node branch
git checkout node

# Install dependencies
npm install

# Build the project
npm run build

# Run the application
npm start
```

## Key Differences

### Process Creation
- Bun uses `Bun.spawn()` with pipe configuration
- Node.js uses `fork()` with IPC channel

### Stream Handling
- Bun uses async iterators for stream handling
- Node.js uses EventEmitter pattern

### Module System
- Bun has simpler ESM handling
- Node.js requires additional configuration for ESM

### Build Process
- Bun runs TypeScript directly
- Node.js requires compilation step

## Implementation Details

Both versions implement:
1. Main process that maintains game state
2. Physics process that simulates movement
3. Protocol Buffers for data serialization
4. 60 FPS update loop
5. Error handling and process cleanup

The main difference is in how each runtime handles:
- Process spawning
- Stream management
- Module resolution
- TypeScript integration

## Performance Considerations

While both implementations achieve the same goal, they have different performance characteristics:
on a MacBook Pro, this particular example runs a lot faster on node than on bun
