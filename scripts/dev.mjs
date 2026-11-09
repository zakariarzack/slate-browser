import { spawn } from 'child_process';
import http from 'http';

function waitForServer(url, timeoutMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, () => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Vite dev server timed out'));
        } else {
          setTimeout(check, 100);
        }
      });
      req.end();
    };
    check();
  });
}

console.log('🚀 Starting Vite development server...');
const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  vite.kill();
  process.exit(0);
});

try {
  await waitForServer('http://localhost:5173');
  console.log('⚡ Vite dev server is live at http://localhost:5173');
  console.log('⚡ Launching Electron with Hot Module Replacement (HMR)...');

  const electron = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electron.on('close', (code) => {
    try {
      vite.kill();
    } catch (e) {}
    process.exit(code || 0);
  });
} catch (err) {
  console.error('❌ Failed to start dev environment:', err);
  try {
    vite.kill();
  } catch (e) {}
  process.exit(1);
}
