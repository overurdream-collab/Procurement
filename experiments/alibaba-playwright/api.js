const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.ALIBABA_API_PORT || 8790);
const SCRIPT = path.join(__dirname, 'test-alibaba.js');
const jobs = new Map();
let runningJobId = null;
const queue = [];

function send(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': 'http://localhost:8787',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 100000) {
        reject(new Error('request_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

function parseReport(stdout) {
  const a = stdout.indexOf('================ REPORT ================');
  const b = stdout.indexOf('========================================', a + 1);
  if (a < 0 || b < 0) return null;
  const chunk = stdout.slice(a + '================ REPORT ================'.length, b).trim();
  try { return JSON.parse(chunk); } catch { return null; }
}

function runNext() {
  if (runningJobId || !queue.length) return;
  const id = queue.shift();
  const job = jobs.get(id);
  if (!job) return runNext();

  runningJobId = id;
  job.status = 'running';
  job.startedAt = new Date().toISOString();

  const child = spawn(process.execPath, [SCRIPT, job.query], {
    cwd: __dirname,
    env: {
      ...process.env,
      MAX_RESULTS: String(job.limit),
      KEEP_OPEN_MS: '0'
    },
    windowsHide: false
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', d => {
    const chunk = d.toString();
    stdout += chunk;
    if (chunk.includes('VERIFICATION_REQUIRED')) {
      job.status = 'verification_required';
      job.message = 'Alibaba requires manual slider verification in the opened browser.';
    }
    if (chunk.includes('VERIFICATION_CLEARED')) {
      job.status = 'running';
      job.message = 'Verification cleared; continuing search.';
    }
  });
  child.stderr.on('data', d => { stderr += d.toString(); });

  child.on('close', code => {
    job.finishedAt = new Date().toISOString();
    job.exitCode = code;
    job.stderr = stderr.slice(-8000);
    const report = parseReport(stdout);
    if (report) {
      job.status = report.error ? 'failed' : 'completed';
      job.report = report;
      job.results = report.results || [];
      job.checks = report.checks || {};
    } else {
      job.status = 'failed';
      job.error = 'Could not parse Alibaba test report';
      job.stdoutTail = stdout.slice(-8000);
    }
    runningJobId = null;
    runNext();
  });

  child.on('error', err => {
    job.status = 'failed';
    job.error = err.message;
    job.finishedAt = new Date().toISOString();
    runningJobId = null;
    runNext();
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, {
        ok: true,
        service: 'alibaba-market-search-poc',
        runningJobId,
        queued: queue.length
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/market-search') {
      const body = await readJson(req);
      const query = String(body.query || '').trim();
      if (!query) return send(res, 400, { error: 'query_required' });

      const limit = Math.max(1, Math.min(20, Number(body.limit || 10)));
      const id = 'AMS-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
      const job = {
        id,
        source: 'Alibaba',
        query,
        limit,
        status: 'queued',
        createdAt: new Date().toISOString(),
        results: []
      };
      jobs.set(id, job);
      queue.push(id);
      runNext();
      return send(res, 202, { id, status: job.status, query, limit });
    }

    const m = url.pathname.match(/^\/api\/market-search\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      const job = jobs.get(m[1]);
      if (!job) return send(res, 404, { error: 'search_not_found' });
      return send(res, 200, job);
    }

    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log('Alibaba Market Search POC API: http://localhost:' + PORT);
});
