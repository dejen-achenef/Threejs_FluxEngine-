import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Scene } from './Scene';
import { Camera } from './Camera';
import { Interaction } from './Interaction';

/**
 * Think of the Engine as the conductor of our 3D orchestra.
 * it's the glue that holds the renderer, the scene, the camera, and 
 * the user interactions together and keeps them all ticking in sync.
 */
export class Engine {
  public renderer: Renderer;
  public scene: Scene;
  public camera: Camera;
  public interaction: Interaction;
  public clock: THREE.Clock;

  private animationId: number | null = null;
  private isRunning = false;

  constructor(canvas: HTMLCanvasElement) {
    // We instantiate everything in a specific order so they can talk to each other
    this.renderer = new Renderer(canvas);
    this.scene = new Scene();
    this.camera = new Camera(canvas);
    this.interaction = new Interaction(this.camera.camera, canvas, this.scene.scene);
    this.clock = new THREE.Clock();

    this.setupResizeHandling();
  }

  // Makes sure that if you resize your browser window, the PCB doesn't get stretched or squashed
  private setupResizeHandling(): void {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.renderer.resize(width, height);
      this.camera.resize(width, height);
    };

    window.addEventListener('resize', handleResize);
  }

  // Kicks off the heart of the engine—the animation loop
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.animate();
  }

  // Pauses the engine and stops the battery-hungry loop
  public stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // This function runs every single frame (ideally 60 times a second)
  private animate = (): void => {
    if (!this.isRunning) return;

    this.clock.getDelta(); // Keep track of time for smooth animations

    // Smooth out the camera movements
    this.camera.update();

    // Draw the actual final image on the screen
    this.renderer.render(this.scene.scene, this.camera.camera);

    // Ask the browser to call us again for the next frame
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * This is super important: we have to manually tell the browser 
   * to delete all the 3D data from the GPU memory when we're done.
   * If we don't, the tab will eventually crash.
   */
  public dispose(): void {
    this.stop();

    // We clean up in reverse order to ensure references stay valid while being deleted
    this.interaction.dispose();
    this.camera.dispose();
    this.scene.dispose();
    this.renderer.dispose();

    console.log('Engine shut down and memory cleared.');
  }

  // Just a quick way to peek at how many assets we're currently using
  public getMemoryInfo(): { geometries: number; textures: number } {
    return this.renderer.getMemoryInfo();
  }

  // Wipes the board clean so we can start over or load a new design
  public reset(): void {
    this.scene.dispose();
    this.scene = new Scene();

    this.interaction.deselectObject();
    this.interaction.clearHoverState();
  }
}
