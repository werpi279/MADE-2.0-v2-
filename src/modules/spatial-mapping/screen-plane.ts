import type { SpatialMapping } from '../../types/modules';
import type { Pt2D, Quat, Stroke } from '../../types/intent-graph';

// Scale factors matching v1's volume.ts — maps normalised [0,1] to Three.js scene units.
// Chosen so the camera frustum at z=5 is fully utilised (±2 on X, ±1.5 on Y).
export const X_SCALE = 4.0;
export const Y_SCALE = 3.0;

const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

export class ScreenPlaneMapping implements SpatialMapping {
  /**
   * Convert a sequence of normalised screen positions (collected while penDown)
   * into a Stroke at the screen-parallel plane, tagged with the workpiece orientation.
   *
   * x is flipped because the camera feed is mirrored: landmark x=0 is the
   * user's right side, x=1 is their left.
   */
  mapStroke(pointer: Pt2D[], orientation: Quat = IDENTITY_QUAT): Stroke {
    return {
      points2D: pointer.map(p => ({
        x: (0.5 - p.x) * X_SCALE,
        y: (0.5 - p.y) * Y_SCALE,
      })),
      planeOrientation: orientation,
      engaged: pointer.length > 0,
    };
  }
}
