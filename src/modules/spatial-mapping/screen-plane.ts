import type { SpatialMapping } from '../../types/modules';
import type { Pt2D, Quat, Stroke } from '../../types/intent-graph';

const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

// V2: draw on the screen-parallel plane; depth inferred from workpiece rotation between strokes.
// penDown points map directly to screen x,y; planeOrientation is the workpiece orientation at stroke start.
export class ScreenPlaneMapping implements SpatialMapping {
  mapStroke(pointer: Pt2D[], orientation: Quat = IDENTITY_QUAT): Stroke {
    return {
      points2D: pointer,
      planeOrientation: orientation,
      engaged: pointer.length > 0,
    };
  }
}
