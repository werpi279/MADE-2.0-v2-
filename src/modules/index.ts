import { MediaPipeHandTracking } from './hand-tracking/mediapipe';
import { RuleGestureRecognizer } from './gesture-recognizer/rules';
import { ScreenPlaneMapping } from './spatial-mapping/screen-plane';
import { WebSpeech } from './speech/webspeech';
import { ClipEmbeddingRecognizer } from './shape-recognizer/clip-embedding';
import { HypothesisEngine } from './interpreter/hypothesis-engine';
import { TemplateProvider } from './form-provider/template-provider';
import { GenerationProvider } from './form-provider/generation-provider';
import { RetrievalProvider } from './form-provider/retrieval-provider';
import { FormProviderChain } from './form-provider/chain';
import { LocalSidecar } from './generation-backend/local-sidecar';
import { MeshEngine } from './geometry-engine/mesh-engine';
import { ThreeRenderer } from './renderer/three-renderer';
import { BehavioralSignal } from './satisfaction-signal/behavioral-signal';
import { LocalStore } from './store/local-store';

import type {
  HandTracking, GestureRecognizer, SpatialMapping, Speech,
  ShapeRecognizer, Interpreter, FormProvider, GenerationBackend,
  GeometryEngine, Renderer, SatisfactionSignal, Store,
} from '../types/modules';

export interface Modules {
  handTracking: HandTracking;
  gestureRecognizer: GestureRecognizer;
  spatialMapping: SpatialMapping;
  speech: Speech;
  shapeRecognizer: ShapeRecognizer;
  interpreter: Interpreter;
  formProvider: FormProvider;
  generationBackend: GenerationBackend;
  geometryEngine: GeometryEngine;
  renderer: Renderer;
  satisfactionSignal: SatisfactionSignal;
  store: Store;
}

// Instantiate all modules per config.ts selection.
// To swap: change config.ts and add the new class here.
export function createModules(): Modules {
  const generationBackend = new LocalSidecar();

  return {
    handTracking:       new MediaPipeHandTracking(),
    gestureRecognizer:  new RuleGestureRecognizer(),
    spatialMapping:     new ScreenPlaneMapping(),
    speech:             new WebSpeech(),
    shapeRecognizer:    new ClipEmbeddingRecognizer(),
    interpreter:        new HypothesisEngine(),
    formProvider:       new FormProviderChain([
                          new TemplateProvider(),
                          new GenerationProvider(generationBackend),
                          new RetrievalProvider(),
                        ]),
    generationBackend,
    geometryEngine:     new MeshEngine(),
    renderer:           new ThreeRenderer(),
    satisfactionSignal: new BehavioralSignal(),
    store:              new LocalStore(),
  };
}
