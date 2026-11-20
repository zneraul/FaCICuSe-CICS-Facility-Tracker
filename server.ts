import { startServer } from './server/index.js';

startServer().catch((error) => {
  console.error('Failed to start FaCICuSe server:', error);
  process.exit(1);
});
