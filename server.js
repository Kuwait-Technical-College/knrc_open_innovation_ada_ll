const path = require('node:path');
const express = require('express');
const config = require('./src/config');
const cameras = require('./src/cameras');
const motor = require('./src/motor');

const app = express();

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/stream/:id', (req, res) => cameras.handleStream(req.params.id, req, res));

app.get('/api/status', (req, res) => {
  res.json({ cameras: cameras.status(), motor: { connected: motor.connected, busy: motor.busy } });
});

app.post('/api/motor/spin', async (req, res) => {
  try {
    await motor.spin();
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${config.port}`);
});

function shutdown() {
  cameras.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
