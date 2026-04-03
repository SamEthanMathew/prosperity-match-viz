import { execSync } from 'node:child_process';

const url = 'http://localhost:5173/backtest';

if (process.platform === 'darwin') {
  execSync(`open ${url}`, { stdio: 'inherit' });
} else if (process.platform === 'win32') {
  execSync(`start "" "${url}"`, { shell: 'cmd.exe', stdio: 'inherit' });
} else {
  execSync(`xdg-open "${url}"`, { stdio: 'inherit' });
}
