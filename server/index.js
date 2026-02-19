const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DATA_PATH = path.join(__dirname, 'data.json');
let territories = [];
try {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  territories = JSON.parse(raw);
} catch {}

function save() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(territories));
  } catch {}
}

function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 100000;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

function toTurfPolygon(path) {
  const coords = path.map((p) => [p.longitude, p.latitude]);
  if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return turf.polygon([coords]);
}

app.get('/territories', (req, res) => {
  res.json(territories.sort((a, b) => b.createdAt - a.createdAt));
});

app.post('/territories', (req, res) => {
  const { name, ownerId, polygon } = req.body || {};
  if (!name || !ownerId || !Array.isArray(polygon) || polygon.length < 3) {
    return res.status(400).json({ error: 'invalid' });
  }
  const perimeter = perimeterMeters(polygon);
  const areaSq = areaMeters(polygon);
  const claimed = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    name,
    ownerId,
    color: colorFromId(ownerId),
    createdAt: Date.now(),
    polygon,
    perimeterMeters: Math.round(perimeter),
    areaSqMeters: Math.round(areaSq)
  };
  territories.unshift(claimed);
  const turfA = toTurfPolygon(polygon);
  const conquered = [];
  territories = territories.map((t) => {
    if (t.id === claimed.id) return t;
    const inter = turf.intersect(turfA, toTurfPolygon(t.polygon));
    if (!inter) return t;
    const interArea = turf.area(inter);
    const ratio = interArea / (t.areaSqMeters || 1);
    if (ratio >= 0.5) {
      const next = { ...t, ownerId, color: colorFromId(ownerId) };
      conquered.push(next.id);
      return next;
    }
    return t;
  });
  save();
  broadcast({ type: 'snapshot', territories });
  res.json({ claimed, conquered });
});

app.delete('/territories/:id', (req, res) => {
  const { id } = req.params;
  const { ownerId } = req.query;
  const t = territories.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (!ownerId || t.ownerId !== ownerId) return res.status(403).json({ error: 'forbidden' });
  territories = territories.filter((x) => x.id !== id);
  save();
  broadcast({ type: 'snapshot', territories });
  res.json({ ok: true });
});

function perimeterMeters(path) {
  const R = 6371000;
  function hav(a, b) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon));
    return R * c;
  }
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += hav(path[i - 1], path[i]);
  sum += hav(path[path.length - 1], path[0]);
  return sum;
}

function areaMeters(path) {
  return turf.area(toTurfPolygon(path));
}

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });
function broadcast(message) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    try { client.send(data); } catch {}
  });
}
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'snapshot', territories }));
});
