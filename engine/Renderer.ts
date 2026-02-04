import * as THREE from 'three';

/**
 * The Renderer is our direct link to the GPU.
 * Its job is to take the 3D world we've built and turn it into pixels on a 2D screen.
 */
export class Renderer {
  public renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {

    if (!canvas) {
      throw new Error('I need a canvas element to start drawing!');
    }

    // Fallback in case the canvas hasn't been sized by CSS yet
    if (!canvas.width || !canvas.height) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    try {
      // We're pushing for high performance here, using antialiasing for smooth edges
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance', // Use the dedicated GPU if available
        stencil: false,
        depth: true,
        failIfMajorPerformanceCaveat: false
      });

      this.configure();
    } catch (error) {
      console.error('WebGL failed to start on the first try:', error);

      // If the fancy version fails, try a "safe" version without the bells and whistles
      try {
        console.log('Trying a simpler renderer fallback...');
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false
        });
        this.configure();
        console.log('Simple renderer is up and running!');
      } catch (fallbackError) {
        console.error('Even the fallback failed. Your hardware might not support WebGL.', fallbackError);
        throw new Error('Could not start the 3D engine. Check your browser settings.');
      }
    }
  }

  private readonly CLEAR_COLOR = 0x0a0a0a; // Deeper workspace background

  // Setting up the visuals to make the PCB look professional
  private configure(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Don't render more pixels than the screen actually has
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Set a nice dark background for the workspace
    this.renderer.setClearColor(this.CLEAR_COLOR);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Enable soft lighting shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Don't auto-reset stats so we can read them accurately
    this.renderer.info.autoReset = false;
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  /**
   * We have to be very careful here. Turning off Three.js isn't as simple as 
   * closing the tab. We have to force the GPU context to close.
   */
  public dispose(): void {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // Tells us exactly how many assets the GPU is holding onto
  public getMemoryInfo(): { geometries: number; textures: number } {
    return {
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures
    };
  }
}
