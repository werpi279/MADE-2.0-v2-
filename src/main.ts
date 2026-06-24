import './style.css';
import { MADEApp } from './app';
import { startCapture } from './capture/capture';

const container = document.getElementById('app')!;
const video     = document.createElement('video');
video.style.display = 'none';
document.body.appendChild(video);

const app = new MADEApp(container);

// ── Status overlay ──────────────────────────────────────────────────────────
const overlay = document.createElement('div');
overlay.id = 'status';
document.body.appendChild(overlay);

function setStatus(msg: string): void {
  overlay.textContent = msg;
}
app.onStatus = setStatus;

// ── Satisfaction-signal → auto-reveal force-input ───────────────────────────
app.onSatisfaction = (state) => {
  const wrap = document.getElementById('force-wrap');
  if (wrap) wrap.style.display = state.showForceInput ? 'flex' : 'none';
};

// ── Lock / Reject / Force-input buttons ─────────────────────────────────────
const controls = document.createElement('div');
controls.id = 'controls';
controls.innerHTML = `
  <button id="btn-lock" title="Lock hypothesis (Enter)">Lock ✓</button>
  <button id="btn-reject" title="Reject / clear strokes (Esc)">Reject ✗</button>
  <div id="force-wrap">
    <input id="force-input" type="text" placeholder="Name this shape…" autocomplete="off" />
    <button id="btn-force">Force</button>
  </div>
  <div id="export-wrap">
    <button id="btn-export-obj" title="Export as OBJ">Save OBJ</button>
    <button id="btn-export-glb" title="Export as GLB">Save GLB</button>
  </div>
`;
document.body.appendChild(controls);

const btnLock   = document.getElementById('btn-lock')!;
const btnReject = document.getElementById('btn-reject')!;
const forceInput = document.getElementById('force-input') as HTMLInputElement;
const btnForce  = document.getElementById('btn-force')!;

btnLock.addEventListener('click', () => app.lockTop());
btnReject.addEventListener('click', () => app.reject());
btnForce.addEventListener('click', () => {
  const label = forceInput.value.trim();
  if (label) { void app.forceConcept(label); forceInput.value = ''; }
});

function _downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('btn-export-obj')!.addEventListener('click', async () => {
  try {
    setStatus('Exporting OBJ…');
    const blob = await app.export('obj');
    _downloadBlob(blob, 'model.obj');
    setStatus('OBJ exported');
  } catch (e) { setStatus(`Export error: ${(e as Error).message}`); }
});

document.getElementById('btn-export-glb')!.addEventListener('click', async () => {
  try {
    setStatus('Exporting GLB…');
    const blob = await app.export('glb');
    _downloadBlob(blob, 'model.glb');
    setStatus('GLB exported');
  } catch (e) { setStatus(`Export error: ${(e as Error).message}`); }
});

document.addEventListener('keydown', e => {
  if (e.target === forceInput) return;
  if (e.key === 'Enter') app.lockTop();
  if (e.key === 'Escape') app.reject();
});

// ── Tauri: first-run weight-download notification ────────────────────────────
if (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined') {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<void>('weights-missing', () => {
      setStatus('First run: TripoSR weights missing — click to download (~1 GB)');
      overlay.style.cursor = 'pointer';
      overlay.onclick = async () => {
        setStatus('Downloading TripoSR weights…');
        overlay.style.cursor = '';
        overlay.onclick = null;
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('download_weights').catch((e: unknown) =>
          setStatus(`Download error: ${(e as Error).message}`),
        );
      };
    });
  });
}

// ── Start button (getUserMedia requires user gesture) ────────────────────────
const startBtn = document.createElement('div');
startBtn.id = 'start-screen';
startBtn.innerHTML = `
  <div class="start-logo">MADE</div>
  <div class="start-sub">Manual Approach in Digital Environment</div>
  <button id="start-btn">Start — allow camera</button>
  <div class="start-note">Webcam used locally · no data leaves your browser</div>
`;
document.body.appendChild(startBtn);

document.getElementById('start-btn')!.addEventListener('click', async () => {
  startBtn.remove();
  setStatus('Requesting camera…');
  try {
    await startCapture(video);
  } catch (err) {
    setStatus(`Camera error: ${(err as Error).message}`);
    return;
  }
  app.setVideo(video);
  setStatus('Loading MediaPipe hand tracking…');
  try {
    await app.setup();
  } catch (err) {
    setStatus(`Model load error: ${(err as Error).message}`);
    return;
  }
  app.start();
  setStatus('Show your hands — pinch to draw');
});
