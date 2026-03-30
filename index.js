// Replit entrypoint — installs deps, builds frontend, starts backend
const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('Installing dependencies...');
execSync('cd frontend && npm install', { stdio: 'inherit' });
execSync('cd backend && npm install', { stdio: 'inherit' });

console.log('Building frontend...');
execSync('cd frontend && npm run build', { stdio: 'inherit' });

console.log('Starting BetIQ server...');
const server = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
});

server.on('exit', code => process.exit(code));
