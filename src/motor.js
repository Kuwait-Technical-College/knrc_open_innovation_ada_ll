const { SerialPort } = require('serialport');
const config = require('./config');

const RECONNECT_MS = 2000;

class Motor {
  constructor({ serialPath, baudRate, timeoutMs }) {
    this.serialPath = serialPath;
    this.baudRate = baudRate;
    this.timeoutMs = timeoutMs;
    this.port = null;
    this.connected = false;
    this.pending = null; // { resolve, reject, timer }
    this.rx = '';
    this.reconnectTimer = null;
    this.connect();
  }

  connect() {
    const port = new SerialPort({ path: this.serialPath, baudRate: this.baudRate, autoOpen: false });
    this.port = port;
    port.on('data', (d) => this.onData(d));
    port.on('close', () => {
      this.connected = false;
      this.settle('reject', new Error('Brain disconnected'));
      this.scheduleReconnect();
    });
    port.on('error', (err) => console.error(`[motor] serial error: ${err.message}`));
    port.open((err) => {
      if (err) {
        console.error(`[motor] cannot open ${this.serialPath}: ${err.message}`);
        this.scheduleReconnect();
        return;
      }
      this.connected = true;
      this.rx = '';
      console.log('[motor] brain serial port open');
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  onData(data) {
    this.rx += data.toString('utf8');
    let nl;
    while ((nl = this.rx.indexOf('\n')) !== -1) {
      const line = this.rx.slice(0, nl).trim();
      this.rx = this.rx.slice(nl + 1);
      this.onLine(line);
    }
    if (this.rx.length > 4096) this.rx = '';
  }

  onLine(line) {
    if (!this.pending) return;
    if (line === 'OK') this.settle('resolve', line);
    else if (line.startsWith('ERR')) this.settle('reject', new Error(`Brain error: ${line}`));
  }

  settle(kind, value) {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    p[kind](value);
  }

  get busy() {
    return Boolean(this.pending);
  }

  command(cmd) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(Object.assign(new Error('Brain not connected'), { status: 503 }));
      if (this.pending) return reject(Object.assign(new Error('Motor is busy'), { status: 409 }));
      const timer = setTimeout(
        () => this.settle('reject', Object.assign(new Error('Brain did not respond (is the program running?)'), { status: 504 })),
        this.timeoutMs,
      );
      this.pending = { resolve, reject, timer };
      this.port.write(`${cmd}\n`, (err) => {
        if (err) this.settle('reject', err);
      });
    });
  }

  spin() {
    return this.command('SPIN');
  }

  stop() {
    return this.command('STOP');
  }
}

module.exports = new Motor(config.motor);
