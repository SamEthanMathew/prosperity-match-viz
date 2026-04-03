import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';

const MAX_TRADER_BYTES = 2 * 1024 * 1024;
const RUST_TIMEOUT_MS = 10 * 60 * 1000;

const ALLOWED_DATASET_KEYS = new Set([
  'tutorial',
  'latest',
  'round1',
  'round2',
  'round3',
  'round4',
  'round5',
  'round6',
  'round7',
  'round8',
  'tutorial-d-1',
  'tutorial-d-2',
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r6',
  'r7',
  'r8',
]);

async function resolveDatasetPath(datasetsRoot, key) {
  const root = path.resolve(datasetsRoot);
  const k = String(key || 'tutorial').toLowerCase();
  if (!ALLOWED_DATASET_KEYS.has(k)) {
    throw new Error(`Unknown dataset: ${key}`);
  }
  const mapRound = (n) => path.join(root, `round${n}`);
  switch (k) {
    case 'tutorial':
      return path.join(root, 'tutorial');
    case 'latest': {
      for (let n = 8; n >= 1; n--) {
        const p = mapRound(n);
        try {
          const st = await fs.stat(p);
          if (st.isDirectory()) {
            const entries = await fs.readdir(p);
            if (entries.length > 0) return p;
          }
        } catch {
          /* continue */
        }
      }
      return path.join(root, 'tutorial');
    }
    case 'round1':
    case 'r1':
      return mapRound(1);
    case 'round2':
    case 'r2':
      return mapRound(2);
    case 'round3':
    case 'r3':
      return mapRound(3);
    case 'round4':
    case 'r4':
      return mapRound(4);
    case 'round5':
    case 'r5':
      return mapRound(5);
    case 'round6':
    case 'r6':
      return mapRound(6);
    case 'round7':
    case 'r7':
      return mapRound(7);
    case 'round8':
    case 'r8':
      return mapRound(8);
    case 'tutorial-d-1':
      return path.join(root, 'tutorial', 'prices_round_0_day_-1.csv');
    case 'tutorial-d-2':
      return path.join(root, 'tutorial', 'prices_round_0_day_-2.csv');
    default:
      throw new Error(`Unhandled dataset key: ${k}`);
  }
}

async function findRunDirWithArtifacts(outputRoot) {
  const entries = await fs.readdir(outputRoot, { withFileTypes: true });
  let bestDir = null;
  let bestMtime = -1;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const sub = path.join(outputRoot, e.name);
    const subLog = path.join(sub, 'submission.log');
    try {
      const stLog = await fs.stat(subLog);
      if (!stLog.isFile()) continue;
      const mtime = stLog.mtimeMs;
      if (mtime > bestMtime) {
        bestMtime = mtime;
        bestDir = sub;
      }
    } catch {
      /* skip */
    }
  }
  return bestDir;
}

function buildGraphLogCsv(pnlSeries) {
  const lines = ['timestamp;value'];
  if (Array.isArray(pnlSeries)) {
    for (const row of pnlSeries) {
      if (row && typeof row.timestamp === 'number' && row.total != null) {
        lines.push(`${row.timestamp};${row.total}`);
      }
    }
  }
  return lines.join('\n');
}

function positionsFromTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];
  const last = timeline[timeline.length - 1];
  const pos = last?.position;
  if (!pos || typeof pos !== 'object') return [];
  return Object.entries(pos).map(([symbol, quantity]) => ({
    symbol,
    quantity: typeof quantity === 'number' ? quantity : Number(quantity),
  }));
}

function bashSingleQuoted(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

async function zipMatchArtifacts(vizJsonObj, replayLogStr) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];
    archive.on('data', (c) => chunks.push(c));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.append(JSON.stringify(vizJsonObj), { name: 'match.json' });
    archive.append(replayLogStr, { name: 'replay.log' });
    archive.finalize();
  });
}

function runRustBacktester({
  bin,
  traderPath,
  datasetPath,
  outputRoot,
  runIdSeed,
  day,
  carry,
  tradeMatchMode,
  queuePenetration,
  priceSlippageBps,
  env,
  darwinDyldFallback,
}) {
  const args = [
    '--trader',
    traderPath,
    '--dataset',
    datasetPath,
    '--output-root',
    outputRoot,
    '--run-id',
    runIdSeed,
    '--artifact-mode',
    'full',
    '--trade-match-mode',
    tradeMatchMode,
    '--queue-penetration',
    String(queuePenetration),
    '--price-slippage-bps',
    String(priceSlippageBps),
  ];
  if (day !== '' && day != null && !Number.isNaN(Number(day))) {
    args.push('--day', String(Number(day)));
  }
  if (carry === '1' || carry === 'true' || carry === true) {
    args.push('--carry');
  }

  let execPath = bin;
  let execArgs = args;
  if (process.platform === 'darwin' && darwinDyldFallback) {
    const script = `export DYLD_FALLBACK_LIBRARY_PATH=${bashSingleQuoted(darwinDyldFallback)}; exec ${bashSingleQuoted(bin)} ${args.map(bashSingleQuoted).join(' ')}`;
    execPath = '/bin/bash';
    execArgs = ['-c', script];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(execPath, execArgs, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('rust_backtester timed out'));
    }, RUST_TIMEOUT_MS);
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `rust_backtester exited ${code}${stderr ? `: ${stderr.slice(-4000)}` : ''}`,
          ),
        );
    });
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trader-upload-'));
      req._uploadDir = dir;
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, 'trader.py');
    },
  }),
  limits: { fileSize: MAX_TRADER_BYTES },
});

const app = express();
if (process.env.BACKTEST_CORS_ORIGIN === '*') {
  app.use(cors({ origin: true }));
} else {
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
          return cb(null, true);
        }
        cb(null, false);
      },
    }),
  );
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'prosperity-backtest-api' });
});

app.post('/api/backtest', upload.single('trader'), async (req, res) => {
  const uploadDir = req._uploadDir;
  const traderPath = req.file?.path;

  const cleanup = async () => {
    try {
      if (uploadDir) await fs.rm(uploadDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };

  try {
    const bin = process.env.RUST_BACKTESTER_BIN;
    const datasetsRoot = process.env.BACKTEST_DATASETS_ROOT;
    if (!bin) {
      res.status(500).json({ error: 'RUST_BACKTESTER_BIN is not set' });
      await cleanup();
      return;
    }
    if (!datasetsRoot) {
      res.status(500).json({ error: 'BACKTEST_DATASETS_ROOT is not set' });
      await cleanup();
      return;
    }

    if (!traderPath) {
      res.status(400).json({ error: 'Missing trader file (field name: trader)' });
      await cleanup();
      return;
    }

    const datasetKey = req.body.dataset || 'tutorial';
    let datasetPath;
    try {
      datasetPath = await resolveDatasetPath(datasetsRoot, datasetKey);
    } catch (e) {
      res.status(400).json({ error: e.message });
      await cleanup();
      return;
    }

    try {
      await fs.access(datasetPath);
    } catch {
      res.status(400).json({
        error: `Dataset path not found: ${datasetPath}. Check BACKTEST_DATASETS_ROOT.`,
      });
      await cleanup();
      return;
    }

    datasetPath = path.resolve(datasetPath);

    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'backtest-out-'));
    const runIdSeed = `api-${Date.now()}`;

    const env = { ...process.env };
    let darwinDyldFallback = null;
    if (process.env.PYTHON_BIN) {
      const pyResolved = fsSync.realpathSync(
        path.resolve(process.env.PYTHON_BIN),
      );
      const pyDir = path.dirname(pyResolved);
      env.PATH = `${pyDir}${path.delimiter}${env.PATH || ''}`;
      const pyLibDir = path.resolve(pyDir, '..', 'lib');
      if (process.platform === 'darwin') {
        darwinDyldFallback = `${pyLibDir}${path.delimiter}/usr/lib${path.delimiter}/usr/local/lib`;
      } else if (process.platform === 'linux') {
        const cur = env.LD_LIBRARY_PATH || '';
        env.LD_LIBRARY_PATH = cur ? `${pyLibDir}${path.delimiter}${cur}` : pyLibDir;
      }
    }

    try {
      await runRustBacktester({
        bin: path.resolve(bin),
        traderPath,
        datasetPath,
        outputRoot,
        runIdSeed,
        day: req.body.day,
        carry: req.body.carry,
        tradeMatchMode: req.body.tradeMatchMode || 'all',
        queuePenetration: req.body.queuePenetration ?? '1',
        priceSlippageBps: req.body.priceSlippageBps ?? '0',
        env,
        darwinDyldFallback,
      });
    } catch (e) {
      await fs.rm(outputRoot, { recursive: true, force: true }).catch(() => {});
      res.status(500).json({ error: e.message || String(e) });
      await cleanup();
      return;
    }

    const runDir = await findRunDirWithArtifacts(outputRoot);
    if (!runDir) {
      await fs.rm(outputRoot, { recursive: true, force: true }).catch(() => {});
      res.status(500).json({ error: 'No run output with submission.log found' });
      await cleanup();
      return;
    }

    let submissionLogRaw;
    let metricsRaw;
    let bundleRaw;
    try {
      submissionLogRaw = await fs.readFile(path.join(runDir, 'submission.log'), 'utf8');
      metricsRaw = await fs.readFile(path.join(runDir, 'metrics.json'), 'utf8');
      bundleRaw = await fs.readFile(path.join(runDir, 'bundle.json'), 'utf8');
    } catch (e) {
      await fs.rm(outputRoot, { recursive: true, force: true }).catch(() => {});
      res.status(500).json({ error: `Failed to read artifacts: ${e.message}` });
      await cleanup();
      return;
    }

    await fs.rm(outputRoot, { recursive: true, force: true }).catch(() => {});
    await cleanup();

    const submission = JSON.parse(submissionLogRaw);
    const metrics = JSON.parse(metricsRaw);
    const bundle = JSON.parse(bundleRaw);

    const pnlSeries = bundle.pnl_series || bundle.pnlSeries;
    const timeline = bundle.timeline || [];
    const graphLog = buildGraphLogCsv(pnlSeries);
    const positions = positionsFromTimeline(timeline);

    const vizJson = {
      round: 'backtest',
      status: 'FINISHED',
      profit: metrics.final_pnl_total ?? 0,
      activitiesLog: submission.activitiesLog || '',
      graphLog,
      positions,
    };

    const zipBuffer = await zipMatchArtifacts(vizJson, submissionLogRaw);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="backtest-match.zip"');
    res.send(zipBuffer);
  } catch (e) {
    await cleanup();
    if (!res.headersSent) {
      res.status(500).json({ error: e.message || String(e) });
    }
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`prosperity-backtest-api listening on http://127.0.0.1:${port}`);
});
