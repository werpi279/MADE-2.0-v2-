# MADE — Specification v2

**M**anual **A**pproach in **D**igital **E**nvironment
Open-source, webcam + voice tool that lets people with no modeling experience create 3D objects by **describing** them with gestures and speech — not by sculpting them. Free to use, free to develop, modular so anyone can improve a part without touching the whole.

> Supersedes v1. v1 treated the system as a *direct-manipulation sculptor* (your gesture = the operation). v2 treats it as an *intent-based describer* (your gesture = a hint about the object in your mind; the system infers and builds it). v1's sculpting engine is **not discarded** — it becomes the Geometry/Mesh Engine module and the "Refine" tier underneath the new intent layer.

---

## 0. What changed from v1, in one paragraph

You are the **art director**, not the sculptor. You speak a simple shared language (objects decomposed into a few primitive shapes), draw on the plane parallel to the screen, and **rotate the object like a CAD modeler** to draw other aspects. The system keeps a **live, ranked hypothesis** of what you're making and **morphs the draft in real time** as evidence accumulates from strokes + speech. Recognition uses a free **on-device embedding** over an open word list (no curated library, no Google Images). Whatever it guesses is only ever a **proposal**: you **lock** a reading to keep it or **reject** it to pin the literal one — nothing is committed silently. If inference struggles, a **force-input** (type/speak) lets you name the part directly. Everything is organized as **swappable modules around a fixed intent-graph spine**, and it ships two ways from one codebase: a zero-install **browser** build and a full-power **desktop app**.

---

## 1. Design Principles (invariants — implementation must not violate)

| # | Principle |
|---|-----------|
| P1 | **Modeless.** The operation is selected by world state + hand position + pose, never a mode button. |
| P2 | **Distance-to-object picks the layer.** Far → navigate the whole workpiece; at the surface → refine; a drawn loop → isolate a part. |
| P3 | **Hands = analog/spatial, Voice = symbolic/discrete.** Hands give where/how-much/shape/direction; voice gives commands, names, exact values, constraints. |
| P4 | **Bimanual asymmetry.** Non-dominant hand holds/orients the workpiece (sets the drawing plane); dominant hand draws/shapes. Concurrent. |
| P5 | **Engagement requires a pinch.** Deliberate pinch = pen-down/act; passing near only previews. Disengage by releasing/moving away. |
| P6 | **Feedback substitutes for missing haptics.** Every imminent action is shown before commit: highlights, influence blobs, ghost previews, translucent sphere/bubble. |
| P7 | **Object-centric, never camera-flying.** The user holds/turns the object; the camera is never flown. (Kills the pan/zoom reversal.) |
| P8 | **Propose, never commit silently.** Inference only ranks hypotheses and morphs the visible draft. State changes only on **lock** (keep) or **reject** (pin literal). |
| P9 | **Modules swap, the spine doesn't.** Every component sits behind a fixed interface and reads/writes the intent graph. Improving performance = replacing an implementation, never moving the spine. |
| P10 | **Hardware-honest & degrade-gracefully.** The core runs real-time on a modest laptop with no GPU. Heavy generation is optional and, when slow, never blocks the core. |

---

## 2. Architecture — modules around a fixed spine

### 2.1 Data flow

```
 webcam ─▶ HandTracking ─▶ GestureRecognizer ─┐
                                              ├─▶ Interpreter ─(lock)─▶ ┌───────────┐
 mic ────▶ Speech ────────────────────────────┘     ▲                  │  INTENT   │
                                                     │                  │  GRAPH    │  ◀── the fixed spine
 SpatialMapping (draw-plane + CAD rotation) ─ strokes┘                  │ (live +   │
                                                                        │  stable)  │
 ShapeRecognizer (sketch → concepts) ──────────────▶ Interpreter        └─────┬─────┘
                                                                              │
 FormProvider ladder  Template ▸ Generation(TripoSR) ▸ Retrieval ◀──────── assemble
                                                                              │
                                          GeometryEngine (build + sculpt) ◀───┘
                                                                              │
                                          Renderer + Feedback ◀───────────────┘
 SatisfactionSignal (lock/reject/redo/dwell) ─▶ Interpreter priors + override trigger
 Persistence/Export · DeliveryShell (browser | app)
```

### 2.2 The fixed spine (never swapped)

The **Intent Graph**, the **module interfaces** below, and the **propose → lock/reject** loop. This is what P9 protects.

### 2.3 Module contracts

Each module is an interface with a default implementation. Swapping = providing another implementation of the same interface, selected by config. Pseudocode signatures (language-agnostic; implement in TS for the web core):

```ts
// 1. HandTracking — frames -> landmark frames
interface HandTracking { track(frame: VideoFrame): HandFrame[] }   // HandFrame = 21 x {x,y,z} per hand
// default: MediaPipeHandTracking

// 2. GestureRecognizer — landmarks -> pose state/events
interface GestureRecognizer { recognize(hands: HandFrame[]): PoseState }
// PoseState = { pinch, openness, cup, gripPoints, framePose, toss, wristRoll, penDown, ... }
// default: RuleGestureRecognizer   |  swap: MLGestureRecognizer

// 3. SpatialMapping — pointer + workpiece orientation -> placed stroke
interface SpatialMapping { mapStroke(pointer: Pt2D[], orientation: Quat): Stroke }
// Stroke = { points2D, planeOrientation, engaged }
// default: ScreenPlaneMapping (uses reliable x,y; depth from rotation between strokes)

// 4. Speech — audio -> command intents + ambient bias
interface Speech { onEvent(cb: (e: VoiceEvent) => void): void }
// VoiceEvent = { kind: "command"|"ambient", text, intent?, keywords? }
// default: WebSpeech (online)  |  swap: VoskSpeech | WhisperSpeech (offline)

// 5. ShapeRecognizer — sketch image -> ranked concepts
interface ShapeRecognizer { recognize(sketch: ImageData, vocab: string[]): ConceptScore[] }
// default: ClipEmbeddingRecognizer (WebGPU/transformers.js)  |  swap: SketchClassifier

// 6. Interpreter — strokes + voice + context -> ranked hypotheses; commit on lock
interface Interpreter {
  update(strokes: Stroke[], voice: VoiceEvent[], ctx: Context): Hypothesis[]   // ranked
  commit(h: Hypothesis): GraphEdit                                             // lock
  force(label: string, target: NodeId): GraphEdit                             // override (deterministic)
}
// default: HypothesisEngine (constructive + retrieval; similarity+simplicity+voice priors; hysteresis)

// 7. FormProvider — concept+sketch -> part geometry (ladder, tried in order)
interface FormProvider { provide(req: FormRequest): Promise<Mesh | null> }     // null => fall through
// chain: TemplateProvider(free) -> GenerationProvider(TripoSR default) -> RetrievalProvider(optional)

// 8. GenerationBackend — where a model runs (used by GenerationProvider)
interface GenerationBackend { generate(image: ImageData, opts): Promise<Mesh> }
// default: LocalSidecar(TripoSR, CPU)  |  swap: LocalSidecar(GPU model) | CloudApi(key) | WebGpuModel | None

// 9. GeometryEngine — build mesh from graph; sculpt locally (Refine)
interface GeometryEngine {
  assemble(graph: IntentGraph): Mesh        // place parts, blend joints, snap constraints
  sculpt(mesh: Mesh, op: SculptOp): Mesh     // local falloff push/pull/scale/smooth
}
// default: MeshEngine (three + three-mesh-bvh + three-bvh-csg + Laplacian)  |  swap: SdfVoxelEngine

// 10. Renderer + Feedback
interface Renderer { render(scene: Scene, fb: FeedbackState): void }

// 11. SatisfactionSignal — behavior -> satisfaction state
interface SatisfactionSignal { update(events: UiEvent[]): SatisfactionState }
// default: BehavioralSignal (lock/reject/redo-count/dwell)  |  swap (future, optional): +FaceAssist

// 12. Persistence/Export
interface Store { save(graph): void; load(): IntentGraph; export(fmt: "obj"|"glb"): Blob }
```

A single `config.ts` selects implementations:

```ts
export const config = {
  handTracking: "mediapipe",
  gestureRecognizer: "rules",
  speech: "webspeech",          // or "vosk" | "whisper"
  shapeRecognizer: "clip",
  generation: { provider: "triposr", backend: "local-cpu" },  // ← the headline swap point
  geometryEngine: "mesh",       // or "sdf-voxel"
  shell: "browser",             // or "app"
};
```

---

## 3. The Intent Graph (the spine's schema)

Two layers; **lock** promotes from live to stable.

**Live layer** — what's being interpreted right now:
- `strokes: Stroke[]` — ordered `{ points2D, planeOrientation, engaged }`.
- `hypotheses: Hypothesis[]` — ranked `{ kind: "constructive"|"retrieval", concept, score, previewMesh }`. Top one is what's drafted.

**Stable layer** — the committed recipe the GeometryEngine builds:
- `nodes: PartNode[]` — `{ id, concept, name?, primitiveOrForm, params{size,proportion,orientation}, transform, sourceStrokes }`.
- `edges: Attachment[]` — `{ from, to, joinType, blendStrength }`.
- `constraints: Constraint[]` — e.g. `round`, `mirror-symmetric`, `flat-bottomed`, locked dimensions.

Rules: locking promotes a hypothesis to a `PartNode` (+ edges/constraints). Everything stable stays editable forever (re-place, re-scale, sculpt, delete). `force(label,…)` writes a node's `concept` at certainty and freezes it — it overrides inference, never competes with it.

---

## 4. Interaction model

### 4.1 Three tiers (all reuse the GeometryEngine; mapped to delivery)

1. **Describe** *(free core, browser + app)* — name + gesture-sketch + place → graph → real-time geometric draft.
2. **Refine** *(free core; v1's engine)* — drop to the surface and directly sculpt a part: pinch push/pull with hand-openness falloff + influence blob; grip-stretch (oval); cup uniform scale; smoothing on by default; voice "sharp" locks an edge.
3. **Conjure** *(optional ingredient; app)* — gesture-sketch → rendered image → Generation model → mesh part into the graph.

### 4.2 Drawing & navigation

- **Draw on the screen-parallel plane** using the camera's reliable x,y. To draw another aspect, **rotate the object** (non-dominant hand on the navigation sphere); each stroke records the plane orientation it was drawn on, so depth comes from rotation *between* strokes, never the noisy hand-z.
- **Navigation sphere** (v1, retained): dashed translucent sphere; highlights on approach, fades to a faint ghost when the hand moves in. Grab + twist = rotate (~half turn); grab + travel = move XYZ; two-hand globe = unlimited rotate; pull toward you = zoom closer. Cup the *sphere* = zoom (view); cup the *object* = scale (geometry).

### 4.3 The transforming draft (hypothesis engine)

A ranked set of hypotheses scored continuously against accumulated strokes-and-configuration, voice keywords, and simplicity. The top one is drafted; each new stroke/word re-scores; when another decisively wins, the draft **morphs** (arc → car roofline as two circles become wheels; S-line hook → teapot as a comma + C become spout + handle). **Hysteresis** prevents flicker. Two hypothesis kinds compete: **constructive** (literal primitive assembly — always available) and **retrieval** (match the whole configuration to a concept via the ShapeRecognizer, then morph). Voice tilts priors before strokes arrive ("car" pre-boosts). When no concept matches, fall through to the Generation provider.

### 4.4 Real vs. transitional input

Per channel, one deliberate register and one ambient register; deliberate edits the graph, ambient only biases interpretation:
- **Gesture:** pinch = pen-down (stroke); release/transit = pen-up (ignored). Pulling the hand back off the plane is a natural pen-lift.
- **Voice:** the small command grammar = deliberate; free thinking-aloud = ambient keyword bias.

### 4.5 Shape-only inference + the force-input floor

Recognition is **shape-only** (the system reads the bare marks and assigns roles) — the ambitious bet. The **force-input** (an always-present type/speak affordance) is the safety floor: with it, recognition never has to be *right*, only *helpful*. It is **highlighted automatically** only when **frustration AND low recognizer confidence** coincide (heavy redraws of the *same* part while the top hypothesis stays weak or keeps flipping) — not on frustration alone, since a confidently-correct draft being redrawn is a design choice, not a labeling failure. The forced word flows down the **form ladder**: it binds to a parametric **template** (naming — free, in-browser) and only **falls through to the Generation model** (true text/image-to-3D prompt) when no template fits or the user wants the richer result. So the same affordance is a **namer** in the browser build and can escalate to a **prompter** in the app build with a model installed.

### 4.6 Satisfaction from behavior, not faces

Close the loop with behavioral signals, not facial-expression recognition (which is scientifically shaky, redundant with explicit lock/reject, a privacy/consent escalation, and dangerous to couple into interpretation probability). Explicit: lock = satisfied; reject/force = dissatisfied + correction. Implicit: redraw-count, hesitation, immediate sculpt of a generated part. These adjust **local, in-session priors only** (private, client-side); a self-improving global model would need data collection + server + consent and is out of scope. (Optional far-future: when uncertain *and* sustained confusion is detected, *offer* the force button — face triggers help, never geometry.)

---

## 5. Delivery — one core, two shells ("premade cake + your ingredients")

- **Browser (GitHub Pages):** the zero-install on-ramp. Describe + Refine + in-browser recognition. All free, no GPU, runs in the visitor's browser. First contact and everyday use.
- **Desktop app (Tauri recommended; Electron alternative):** the same web core in a thin native shell, where heavy ingredients run natively. Tauri = small binaries, system webview + Rust backend, can spawn a Python **sidecar** for the model; Electron = heavier but maximally compatible. The app adds the **Conjure** tier and offline speech; first-run downloads model weights to a known folder.

The core must avoid shell-specific APIs so the identical codebase runs in both (P9).

---

## 6. Where each piece runs

- **In the repo → served by Pages, runs in browser:** the whole core — HandTracking glue, GestureRecognizer, SpatialMapping, Interpreter, Intent Graph, GeometryEngine, Renderer+Feedback, parametric templates, recognizer word list, `config.ts`. **Bundled by Vite:** three, three-mesh-bvh, three-bvh-csg. Plus Vite config and the GitHub Actions Pages workflow.
- **Fetched from CDN at runtime (free, in-browser, no user action):** MediaPipe HandLandmarker model + WASM; CLIP recognizer weights (cached on first load — show a loading state).
- **Browser built-in (no download):** Web Speech API (online), webcam/mic.
- **Downloaded, runs on the user's machine (the optional ingredients, app build):** the Generation model (**TripoSR** baseline; CPU sidecar) and optional offline speech (Vosk/Whisper); optional 3D corpus + index for retrieval.
- **Optional cloud (BYO key):** a hosted generation backend instead of local.

The project (hosting + development) stays free regardless of which ingredients are plugged in.

---

## 7. Hardware baseline & performance — tuned for this machine

**Target dev/run machine: Asus VivoBook (2017), Intel Core i7 (U-series), 16 GB RAM, integrated graphics (no CUDA GPU).**

- **Core (Describe / Refine / navigation / recognition): real-time.** Hand tracking is phone-grade; recognition fires only on stroke completion, not per frame. 16 GB RAM is comfortable for the core.
- **Conjure (local generation): works, slow.** **TripoSR runs CPU-only** (it was designed to run without a GPU); expect ~30–60 s per generation on a typical CPU, and somewhat more on this 2017 i7 — budget **~1–2 minutes per result**. Treat Conjure as "draw → generate → wait a moment," while the free tiers stay instant.
- **RAM is the tight resource during generation.** 16 GB is the recommended floor and CPU inference uses more RAM than GPU; close other apps while generating. Use an SSD for model load.
- **Swap to go faster, not to unlock capability.** Nothing is blocked on this machine. Set `generation.backend = "cloud-api"` (BYO key) or `"local-cpu"` → a GPU model later; the rest of the architecture is unchanged (P9).

**Recommended default config for this machine:** `generation: { provider: "triposr", backend: "local-cpu" }`, browser build for daily work, app build when exercising Conjure.

---

## 8. Tech stack & libraries (verified; free; permissive licenses)

| Role | Library / API | License |
|---|---|---|
| Hand tracking (21×3D, 2 hands) | MediaPipe Tasks Vision `HandLandmarker` (`@mediapipe/tasks-vision`) | Apache-2.0 |
| 3D engine / rendering | Three.js (`three`) | MIT |
| Spatial queries / falloff | three-mesh-bvh | MIT |
| Booleans / CSG (join, cut) | three-bvh-csg | MIT |
| Sketch recognition (embeddings, WebGPU) | transformers.js (`@xenova/transformers`), CLIP-style model | Apache-2.0 |
| Speech (online) | Web Speech API (built-in) | — |
| Generation (default, CPU-capable) | **TripoSR** (image-to-3D) | MIT |
| Build / dev / static bundle | Vite | MIT |
| Deploy | GitHub Actions → GitHub Pages | free (public repos) |
| Desktop shell | Tauri (Electron alternative) | MIT / Apache-2.0 |
| Landmark smoothing (optional) | One-Euro filter (vendored) | MIT |

**Swappable ingredients (post-baseline):** Generation → Hunyuan3D 2.1 / TRELLIS / SF3D (higher fidelity, need a GPU) or a cloud API; Speech → Vosk / Whisper (offline); GeometryEngine → SDF/voxel (authentic clay); Retrieval → an Objaverse-scale corpus + index. Each conforms to its §2.3 interface.

---

## 9. Build milestones (for Claude Code; reuse the existing engine)

> Your current M0–M5 work becomes the **GeometryEngine** module + the **Refine** tier + the navigation sphere. v2 wraps the **intent layer** on top and adds the **app shell** and **generation**.

- **V0 — Modular skeleton.** Vite + TS, MIT, README, Actions→Pages live. Stub every §2.3 interface with a no-op default + `config.ts` selecting them. Confirm the live URL.
- **V1 — Geometry + navigation (port).** Wire v1's engine into `GeometryEngine.assemble/sculpt`; bring in the navigation sphere; confirm Refine-tier sculpting works on a placeholder mesh.
- **V2 — Capture chain.** `HandTracking` (MediaPipe) + `GestureRecognizer` (rules) + `SpatialMapping` (screen-plane + rotation) → render strokes live.
- **V3 — Intent graph + constructive Describe.** Implement the graph; `Interpreter` with the **constructive** hypothesis only (literal primitive assembly); lock/reject; real-time draft.
- **V4 — Recognition + morphing.** Add `ShapeRecognizer` (CLIP) + the **retrieval** hypothesis + scoring/hysteresis → the morphing draft (bow→car, hook→teapot). Add `Speech` (Web Speech) priors + commands.
- **V5 — Force-input + satisfaction.** The type/speak override (namer → template), the frustration+low-confidence trigger, `SatisfactionSignal` (behavioral) feeding local priors.
- **V6 — App shell + Conjure.** Tauri shell; `GenerationBackend = LocalSidecar(TripoSR, CPU)`; first-run weight download; force-input escalates to prompter when a model is present. Keep the browser build fully working in parallel.
- **V7 — Polish + export.** Feedback layer (highlights/blob/ghost/sphere/bubble), `Store` export OBJ/glTF, autosave.

Ship a runnable thing at each milestone; commit per milestone; keep the browser build green throughout.

---

## 10. Claude Code — Bootstrap Injection Prompt (v2)

Paste at the root of a fresh repo (see https://docs.claude.com/en/docs/claude-code/overview). Encodes the intent-based, modular, browser+app, TripoSR-baseline design and the hardware target.

```text
Build MADE (Manual Approach in Digital Environment): an open-source webcam+voice tool
that lets non-modelers create 3D objects by DESCRIBING them with gestures and speech,
not by sculpting. The system interprets gestures + voice into an editable INTENT GRAPH,
then a deterministic engine builds the mesh. It ships as BOTH a free zero-install browser
app (GitHub Pages) and a desktop app (Tauri) from ONE shared web core.

== HARD CONSTRAINTS ==
- Free to use, free to develop. Only MIT/Apache libraries. Repo MIT. Public.
- Browser core is 100% client-side, no backend, no secrets. Deploy via GitHub Actions -> Pages (HTTPS for getUserMedia).
- MODULAR: every component sits behind a fixed interface and reads/writes the intent graph.
  Improving performance = swapping an implementation selected in config.ts. NEVER change the spine.
- HARDWARE TARGET (dev + run): 2017 laptop, Intel i7 (U), 16GB RAM, integrated GPU, NO CUDA.
  Core must be real-time on this. Heavy generation is OPTIONAL and must never block the core.

== THE SPINE (never swap) ==
The Intent Graph + the module interfaces + the propose->lock/reject loop.
Intent Graph: live layer (ordered strokes {points2D, planeOrientation, engaged}; ranked
hypotheses) and stable layer (PartNodes {id, concept, name?, form, params, transform,
sourceStrokes}; Attachments {from,to,joinType,blendStrength}; Constraints). Lock promotes
a hypothesis to a stable node; everything stable stays editable forever. force(label) writes
a node concept at certainty (overrides inference, never competes).

== MODULES (interface + default; swap via config.ts) ==
HandTracking(track)->landmarks: MediaPipe HandLandmarker (tasks-vision), 2 hands, VIDEO, GPU delegate.
GestureRecognizer(recognize)->poseState: hand-tuned rules (pinch, openness, cup, grip, frame, toss, wristRoll, penDown). Swappable to ML.
SpatialMapping(mapStroke): draw on screen-parallel plane (reliable x,y); depth from object rotation BETWEEN strokes (never hand-z).
Speech(onEvent): Web Speech API; small command grammar = deliberate, free speech = ambient bias. Swappable to Vosk/Whisper offline.
ShapeRecognizer(recognize)->{concept,score}[]: CLIP-style embedding (transformers.js/WebGPU) over an OPEN word list. No curated mesh library, no web image search.
Interpreter(update/commit/force): ranked hypotheses = constructive (literal primitive assembly) + retrieval (concept match -> morph), scored by similarity+simplicity+voice priors with HYSTERESIS. Morph the visible draft as evidence arrives. Propose only; commit on lock; force() is a deterministic override.
FormProvider ladder(provide): Template(parametric, free) -> Generation(default TripoSR) -> Retrieval(optional). Try in order; null falls through.
GenerationBackend(generate): default LocalSidecar(TripoSR, CPU). Swap: GPU local | CloudApi(BYO key) | WebGPU | None.
GeometryEngine(assemble/sculpt): three + three-mesh-bvh + three-bvh-csg + Laplacian. assemble = place parts, blend joints, snap constraints; sculpt = local falloff push/pull/scale/smooth (the Refine tier). Swappable to SDF/voxel.
Renderer+Feedback(render): three; highlights, influence blob, ghost preview, dashed sphere, translucent bubble, magnitude readouts.
SatisfactionSignal(update): behavioral (lock/reject/redo-count/dwell) -> local in-session priors + force-input trigger. NO facial-expression recognition.
Store(save/load/export): localStorage/filesystem + OBJ/glTF export.

== INTERACTION ==
Modeless; layer chosen by world-state + hand distance + pose. Draw on the screen-plane and
ROTATE the object (nav sphere, non-dominant hand) to draw other aspects. Live ranked
hypothesis MORPHS the draft (arc->car as two circles become wheels; S-hook->teapot as comma+C
become spout+handle). Voice tilts priors. Engagement requires a pinch; passing near only
previews. Recognition is SHAPE-ONLY; the force-input (type/speak) is the floor, highlighted
ONLY when frustration AND low recognizer confidence coincide. The forced word binds to a
template (free, namer) and only falls through to the Generation model (prompter) when no
template fits or the user wants more.

== DELIVERY ==
One web core, two shells. Browser (Pages): Describe + Refine + in-browser recognition, free,
no GPU. App (Tauri): same core + native Generation sidecar (TripoSR), offline speech; first-run
downloads weights. Core avoids shell-specific APIs.

== BUILD ORDER (runnable per step; keep browser build green) ==
V0 Modular skeleton: Vite+TS, MIT, README, Actions->Pages live; stub all interfaces + config.ts.
V1 Port the geometry/sculpt engine into GeometryEngine + the navigation sphere.
V2 Capture chain: HandTracking + GestureRecognizer(rules) + SpatialMapping -> live strokes.
V3 Intent graph + constructive Describe (literal assembly) + lock/reject + real-time draft.
V4 ShapeRecognizer(CLIP) + retrieval hypothesis + scoring/hysteresis -> morphing draft; Speech priors+commands.
V5 Force-input (namer->template) + frustration/low-confidence trigger + behavioral SatisfactionSignal.
V6 Tauri shell + GenerationBackend LocalSidecar(TripoSR, CPU) + first-run weights + force-input escalates to prompter.
V7 Feedback polish + OBJ/glTF export + autosave.

== ACCEPTANCE ==
On the target laptop, in the browser with no install: a first-timer can summon a draft by
gesture+voice, watch it morph into a recognizable object as they add strokes, lock parts,
refine by direct sculpting, correct a wrong guess via the force-input, navigate via the sphere,
and export OBJ/glTF — all real-time. In the app build, "make it a real <thing>" triggers local
TripoSR generation (slow but fully local) that drops a mesh part into the graph.

Start at V0. After each milestone, summarize what works and what's stubbed, then continue.
Keep it MODELESS, keep inference PROPOSE-ONLY, and keep every component behind its interface.
```

---

## 11. Open questions & risks

- **Shape-only inference is research-grade.** Robustly turning a wobbly comma into a spout on the correct side is the hard, unproven part. The force-input floor + voice priors + lock/reject make shipping safe; set expectations accordingly.
- **GestureRecognizer brittleness.** Hand-tuned rules for cup vs grip vs frame may need a small trained classifier — already a defined swap (`gestureRecognizer: "ml"`).
- **Recognizer weight load.** The CLIP model is a few hundred MB on first load; cache aggressively and show a loading state. Confirm WebGPU works on the target's integrated GPU; fall back to WASM if not.
- **CPU generation latency** (~1–2 min on the target). Communicate it in-UI; keep Conjure off the critical path.
- **App packaging.** Per-OS builds and code-signing (unsigned apps trip OS warnings; signing costs money/setup) and auto-updates are real maintenance. Start with the browser build as primary; treat the app as the power tier.
- **Depth axis** stays the camera's weakest signal — keep all depth from rotation-between-strokes and relative drags, never absolute hand-z.
```
