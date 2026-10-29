const { spawn } = require('node:child_process');
const config = require('./config');

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const RESTART_DELAY_MS = 2000;

// One ffmpeg process per camera, shared by all viewers. Started on the first
// viewer and stopped when the last one leaves.
class CameraStream {
  constructor(id, cam) {
    this.id = id;
    this.cam = cam;
    this.clients = new Set();
    this.proc = null;
    this.buffer = Buffer.alloc(0);
    this.restartTimer = null;
    this.lastFrameAt = 0;
  }

  get live() {
    return Date.now() - this.lastFrameAt < 5000;
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
      if (this.clients.size === 0) this.stop();
    });
    this.start();
  }

  start() {
    if (this.proc || this.restartTimer) return;
    const { size, fps, quality } = config.video;
    const args = [
      '-loglevel', 'error',
      '-f', 'v4l2',
      '-input_format', this.cam.inputFormat,
      '-video_size', size,
      '-framerate', String(fps),
      '-i', this.cam.device,
      '-an',
      '-r', String(fps),
      '-f', 'mjpeg',
      '-q:v', String(quality),
      'pipe:1',
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc = proc;
    this.buffer = Buffer.alloc(0);

    proc.stdout.on('data', (chunk) => this.onData(chunk));
    proc.stderr.on('data', (d) => console.error(`[${this.id}] ffmpeg: ${d.toString().trim()}`));
    proc.on('error', (err) => console.error(`[${this.id}] failed to start ffmpeg: ${err.message}`));
    proc.on('close', () => {
      if (this.proc !== proc) return;
      this.proc = null;
      if (this.clients.size > 0) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (this.clients.size > 0) this.start();
        }, RESTART_DELAY_MS);
      }
    });
  }

  stop() {
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const proc = this.proc;
    this.proc = null;
    if (proc) proc.kill('SIGKILL');
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const start = this.buffer.indexOf(SOI);
      if (start === -1) {
        this.buffer = Buffer.alloc(0);
        return;
      }
      const end = this.buffer.indexOf(EOI, start + 2);
      if (end === -1) {
        this.buffer = this.buffer.subarray(start);
        return;
      }
      const frame = this.buffer.subarray(start, end + 2);
      this.buffer = this.buffer.subarray(end + 2);
      this.broadcast(frame);
    }
  }

  broadcast(frame) {
    this.lastFrameAt = Date.now();
    for (const res of this.clients) {
      // Drop frames for slow clients instead of buffering unboundedly.
      if (res.writableLength > frame.length * 4) continue;
      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
      res.write(frame);
      res.write('\r\n');
    }
  }
}

const streams = Object.fromEntries(
  Object.entries(config.cameras).map(([id, cam]) => [id, new CameraStream(id, cam)]),
);

function handleStream(id, req, res) {
  const stream = streams[id];
  if (!stream) return res.status(404).json({ ok: false, error: 'Unknown camera' });
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'close',
    Pragma: 'no-cache',
  });
  stream.addClient(res);
}

function status() {
  return Object.fromEntries(
    Object.entries(streams).map(([id, s]) => [id, { label: s.cam.label, viewers: s.clients.size, live: s.live }]),
  );
}

function shutdown() {
  Object.values(streams).forEach((s) => s.stop());
}

module.exports = { handleStream, status, shutdown };
