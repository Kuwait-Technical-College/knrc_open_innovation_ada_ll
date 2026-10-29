const button = document.getElementById('spin');
const message = document.getElementById('message');
const brain = document.getElementById('brain');

document.getElementById('cam1').src = '/stream/cam1';
document.getElementById('cam2').src = '/stream/cam2';

function show(text, cls = '') {
  message.textContent = text;
  message.className = cls;
}

button.addEventListener('click', async () => {
  button.disabled = true;
  show('Spinning...');
  try {
    const res = await fetch('/api/motor/spin', { method: 'POST' });
    const body = await res.json();
    if (body.ok) show('Done', 'ok');
    else show(body.error || 'Failed', 'error');
  } catch (err) {
    show('Server unreachable', 'error');
  } finally {
    button.disabled = false;
  }
});

async function refreshStatus() {
  try {
    const s = await (await fetch('/api/status')).json();
    brain.textContent = s.motor.connected ? 'Brain: connected' : 'Brain: not connected';
  } catch {
    brain.textContent = 'Server unreachable';
  }
}
refreshStatus();
setInterval(refreshStatus, 3000);
