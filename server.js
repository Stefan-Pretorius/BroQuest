'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');

const DEFAULT_STATE = {
  version: 0,
  boys: [],
  tasks: [],
  rewards: [],
  goals: [],
  settings: { voiceEnabled: true, soundEnabled: true, pin: '2468' },
  activeBoyId: null
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function writeData(state) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

http.createServer((req, res) => {
  let p;
  try {
    p = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (p === '/api/state') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readData()));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 5e6) req.destroy();
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          writeData(parsed.state || parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'bad json' }));
        }
      });
      return;
    }
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  const ips = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((k) => {
    nets[k].forEach((n) => {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    });
  });
  console.log('BroQuest is running.');
  console.log('  On this computer: http://localhost:' + PORT);
  console.log('  Parent controls: http://localhost:' + PORT + '/parent.html');
  if (ips.length) {
    console.log('  On the iPad (same Wi-Fi): http://' + ips[0] + ':' + PORT);
    console.log('  Parent controls (phone/PC): http://' + ips[0] + ':' + PORT + '/parent.html');
  } else {
    console.log('  No LAN IP found — check that this computer is on Wi-Fi/Ethernet.');
  }
});
