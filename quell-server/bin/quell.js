#!/usr/bin/env node

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Quell requires Node.js 16 or higher');
  console.error(`   Current version: ${nodeVersion}`);
  console.error('   Please upgrade Node.js and try again');
  process.exit(1);
}

// Import and run the CLI
import('../dist/src/cli/index.js').catch((error) => {
  console.error('❌ Failed to load Quell CLI:', error.message);
  process.exit(1);
});