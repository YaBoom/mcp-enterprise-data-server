#!/usr/bin/env node
import { DataMcpServer } from './server.js';

async function main() {
  const server = new DataMcpServer();
  await server.run();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
