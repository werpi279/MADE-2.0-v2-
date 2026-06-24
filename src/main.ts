import './style.css';
import { MADEApp } from './app';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app element');

const app = new MADEApp(container);
app.start();

// V0 status overlay — shows each module and its current implementation tier
const overlay = document.createElement('div');
overlay.id = 'status';
overlay.innerHTML = `
  <div class="status-title">MADE v2 — V0 Skeleton</div>
  <table>
    <tbody>
      <tr><td>HandTracking</td><td class="stub">mediapipe [stub → V2]</td></tr>
      <tr><td>GestureRecognizer</td><td class="stub">rules [stub → V2]</td></tr>
      <tr><td>SpatialMapping</td><td class="stub">screen-plane [stub → V2]</td></tr>
      <tr><td>Speech</td><td class="stub">webspeech [stub → V4]</td></tr>
      <tr><td>ShapeRecognizer</td><td class="stub">clip [stub → V4]</td></tr>
      <tr><td>Interpreter</td><td class="stub">hypothesis-engine [stub → V3]</td></tr>
      <tr><td>FormProvider</td><td class="stub">template→generation→retrieval [stub → V5]</td></tr>
      <tr><td>GenerationBackend</td><td class="stub">local-sidecar/TripoSR [stub → V6]</td></tr>
      <tr><td>GeometryEngine</td><td class="stub">mesh-engine [placeholder → V1]</td></tr>
      <tr><td>Renderer</td><td class="live">three-renderer [live]</td></tr>
      <tr><td>SatisfactionSignal</td><td class="stub">behavioral [stub → V5]</td></tr>
      <tr><td>Store</td><td class="stub">local [localStorage → V7]</td></tr>
    </tbody>
  </table>
`;
document.body.appendChild(overlay);
