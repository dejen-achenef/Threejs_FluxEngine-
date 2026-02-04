import * as THREE from 'three';

/**
 * The Scene is like a 3D stage. 
 * It holds the lighting, the board, and keeps everything organized 
 * so we can move elements without losing track of them.
 */
export class Scene {
  public scene: THREE.Scene;
  private layers: Map<string, THREE.Object3D>;

  constructor() {
    this.scene = new THREE.Scene();
    this.layers = new Map();
    this.setupLighting();
    this.createLayers();
  }

  // We set up a few different lights to make sure the board edges and copper look real
  private setupLighting(): void {
    // A soft light that hits everything so there are no pitch-black shadows
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // The main light, like a lamp over a workbench
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;

    // High-res shadows so things look sharp
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // A subtle light from the other side to help define the 3D shapes
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);
  }

  // We group objects into virtual layers so it's easier to manage visibility later
  private createLayers(): void {
    const layerNames = ['board', 'topCopper', 'bottomCopper', 'components'];

    layerNames.forEach(name => {
      const layer = new THREE.Object3D();
      layer.name = name;
      this.layers.set(name, layer);
      this.scene.add(layer);
    });
  }

  // Handy helper for plopping something onto a specific PCB layer
  public addToLayer(object: THREE.Object3D, layerName: string): void {
    const layer = this.layers.get(layerName);
    if (layer) {
      layer.add(object);
    } else {
      console.warn(`Hm, I couldn't find a layer named "${layerName}", so I'm just adding it to the main scene.`);
      this.scene.add(object);
    }
  }

  public getLayer(layerName: string): THREE.Object3D | undefined {
    return this.layers.get(layerName);
  }

  /**
   * Checks if a specific layer already exists in our scene.
   */
  public hasLayer(layerName: string): boolean {
    return this.layers.has(layerName);
  }

  public removeFromLayer(object: THREE.Object3D, layerName: string): void {
    const layer = this.layers.get(layerName);
    if (layer) {
      layer.remove(object);
    }
  }

  /**
   * This is a deep-clean function.
   * It goes through every single item on the stage and tells the GPU to delete it.
   */
  public dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    this.layers.clear();
    this.scene.clear();
    console.log('Stage cleared and lights out.');
  }
}
