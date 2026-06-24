# MADE — Manual Approach in Digital Environment

Open-source webcam + voice tool that lets people with no modeling experience create 3D objects by **describing** them with gestures and speech — not by sculpting them.

> **Status: V0 — Modular skeleton.** All module interfaces defined; stubs in place; Three.js renderer live; deploy workflow ready. See [milestone map](#milestones) below.

## Try it (browser, no install)

[**Open in browser →**](https://werpi279.github.io/MADE-2.0-v2-/)

Requires a modern browser with WebGL. Webcam is used from V2 onward.

## Design

The system interprets gestures + voice into an editable **Intent Graph**, then a deterministic engine builds the mesh. Everything sits behind a fixed module interface; swapping an implementation (e.g. a faster geometry engine) never touches the rest of the system.

See [`docs/MADE-spec-v2.md`](docs/MADE-spec-v2.md) for the full specification.

## Milestones

| Milestone | What works | Status |
|-----------|-----------|--------|
| **V0** | Vite+TS, all module interfaces, stubs, Three.js canvas, Actions→Pages | ✅ done |
| **V1** | GeometryEngine (v1 port) + navigation sphere | ⏳ next |
| **V2** | HandTracking + GestureRecognizer + SpatialMapping → live strokes | ⬜ |
| **V3** | Intent graph + constructive Describe + lock/reject | ⬜ |
| **V4** | ShapeRecognizer (CLIP) + retrieval hypothesis + morphing + Speech | ⬜ |
| **V5** | Force-input (namer→template) + SatisfactionSignal | ⬜ |
| **V6** | Tauri shell + TripoSR sidecar (CPU) + Conjure tier | ⬜ |
| **V7** | Feedback polish + OBJ/glTF export + autosave | ⬜ |

## Architecture

```
src/
  config.ts              # swap implementations here — never touch types/modules.ts
  types/
    intent-graph.ts      # the fixed spine: IntentGraph schema
    modules.ts           # all module interface contracts
  modules/
    hand-tracking/       # MediaPipeHandTracking (stub → V2)
    gesture-recognizer/  # RuleGestureRecognizer (stub → V2)
    spatial-mapping/     # ScreenPlaneMapping (stub → V2)
    speech/              # WebSpeech (stub → V4)
    shape-recognizer/    # ClipEmbeddingRecognizer (stub → V4)
    interpreter/         # HypothesisEngine (stub → V3)
    form-provider/       # TemplateProvider → GenerationProvider → RetrievalProvider chain
    generation-backend/  # LocalSidecar/TripoSR (stub → V6)
    geometry-engine/     # MeshEngine: three + bvh + csg (placeholder → V1)
    renderer/            # ThreeRenderer (live)
    satisfaction-signal/ # BehavioralSignal (stub → V5)
    store/               # LocalStore: localStorage (stub → V7)
  app.ts                 # main loop
  main.ts                # entry point + V0 status overlay
```

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## License

MIT. Only MIT/Apache dependencies. Free to use, free to develop.
