import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * The Camera is our eye in the 3D world.
 * We've tuned it to feel like you're looking at a real PCB on a desk,
 * with smooth zooming and panning.
 */
export class Camera {
  public camera: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  constructor(canvas: HTMLCanvasElement) {
    // We use a lower FOV (35) to minimize distortion when looking at component edges
    this.camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,  // Near clip: basically right in front of the lens
      1000  // Far clip: way in the distance
    );

    // Initial starting angle—looking down at the board from a corner
    this.camera.position.set(60, 80, 60);
    this.camera.lookAt(0, 0, 0);

    this.setupControls(canvas);
  }

  // Set up the mouse/touch controls that let you orbit the board
  private setupControls(canvas: HTMLCanvasElement): void {
    this.controls = new OrbitControls(this.camera, canvas);

    // Damping makes it feel like the camera has weight—it glides to a stop
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // We limit the tilt so you can't go completely under the table
    this.controls.minPolarAngle = Math.PI * 0.1;
    this.controls.maxPolarAngle = Math.PI * 0.7;

    // Don't let the user zoom too close or too far
    this.controls.minDistance = 20;
    this.controls.maxDistance = 200;

    // Start by looking at the dead center of the design
    this.controls.target.set(0, 0, 0);

    this.controls.update();
  }

  // Keep the aspect ratio correct when the window size changes
  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // We need to call this in the animation loop to process the glides and pans
  public update(): void {
    this.controls.update();
  }

  public dispose(): void {
    this.controls.dispose();
  }

  /**
   * Handy for showing off the board by slowly circling around it
   */
  public setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * If you get lost, just hit the reset button to jump back to the standard view
   */
  public reset(): void {
    this.camera.position.set(60, 80, 60);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
