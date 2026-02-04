import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

/**
 * This class is the "brain" of our interaction system.
 * It handles the math for clicking and hovering on objects (raycasting),
 * manages what's currently highlighted, and lets the user move things around
 * using handy gizmos on the screen.
 */
export class Interaction {
  public raycaster: THREE.Raycaster;
  public mouse: THREE.Vector2;
  private hoveredObject: THREE.Object3D | null = null;
  private selectedObject: THREE.Object3D | null = null;
  private hoveredInstanceId: number | null = null; // Which specific copy of an object are we hovering?
  private selectedInstanceId: number | null = null; // Which specific copy are we highlighting?
  private transformControls: TransformControls | null = null; // The movement handles/gizmos
  private interactableObjects: THREE.Object3D[] = []; // List of things the raycaster can "hit"
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private canvas: HTMLCanvasElement;

  constructor(camera: THREE.Camera, canvas: HTMLCanvasElement, scene: THREE.Scene) {
    this.raycaster = new THREE.Raycaster();
    // A little buffer for selecting thin lines like traces
    this.raycaster.params.Line = { threshold: 0.1 };
    this.mouse = new THREE.Vector2();
    this.camera = camera;
    this.scene = scene;
    this.canvas = canvas;
    this.setupEventListeners();
  }

  // Hook into the browser events so we know when the user moves their mouse or clicks
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
  }

  private onMouseMove(event: MouseEvent): void {
    // We need to map the pixel coordinates to Three.js's "Normalized Device Coordinates" (-1 to +1)
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Check if the cursor is over anything interactable
    this.updateCursor();
  }

  private onClick(_event: MouseEvent): void {
    const intersects = this.performRaycast();

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const object = intersection.object;
      const instanceId = intersection.instanceId || 0;

      // Found something! Let's select it.
      this.selectObject(object, instanceId);
    } else {
      // Clicked empty space? deselect whatever we had selected.
      this.deselectObject();
    }
  }

  // Shoot a "ray" from the camera through the mouse position into 3D space
  private performRaycast(objects?: THREE.Object3D[]): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // If we're not checking specific objects, use our list of interactable ones
    const targetObjects = objects || this.interactableObjects;

    return this.raycaster.intersectObjects(targetObjects, true);
  }

  // This handles the "feel" of hovering—changing the cursor and highlighting objects
  private updateCursor(): void {
    const intersects = this.performRaycast();

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const object = intersection.object;
      const instanceId = intersection.instanceId || 0;

      // Only update if we've moved to a different object or a different copy (instance)
      if (this.hoveredObject !== object || this.hoveredInstanceId !== instanceId) {
        this.clearHoverState();
        this.hoveredObject = object;
        this.hoveredInstanceId = instanceId;

        // Tell the shader to highlight this specific instance
        this.updateInstanceHoverState(object, instanceId, true);
      }

      this.canvas.style.cursor = 'pointer';
    } else {
      this.canvas.style.cursor = 'default';
      this.clearHoverState();
    }
  }

  // Clean up the highlight when the mouse moves away
  public clearHoverState(): void {
    if (this.hoveredObject && this.hoveredInstanceId !== null) {
      this.updateInstanceHoverState(this.hoveredObject, this.hoveredInstanceId, false);
      this.hoveredObject = null;
      this.hoveredInstanceId = null;
    }
  }

  // Logic to handle highlighting either a single mesh or a specific piece of an InstancedMesh
  private updateInstanceHoverState(object: THREE.Object3D, instanceId: number, hovered: boolean): void {
    if (object instanceof THREE.InstancedMesh) {
      this.updateInstancedMeshHover(object, instanceId, hovered);
    } else if (object instanceof THREE.Mesh) {
      this.updateShaderUniform(object, 'uHovered', hovered);
    }
  }

  // This talks directly to our custom shader to highlight just one instance out of many
  private updateInstancedMeshHover(instancedMesh: THREE.InstancedMesh, instanceId: number, hovered: boolean): void {
    const material = instancedMesh.material as THREE.ShaderMaterial;
    if (material && material.uniforms) {
      if (material.uniforms.uHovered) {
        material.uniforms.uHovered.value = hovered;
      }
      if (material.uniforms.uHoveredInstanceId) {
        material.uniforms.uHoveredInstanceId.value = hovered ? instanceId : -1.0;
      }
    }
  }

  // Mark an object as selected and show the movement handles
  public selectObject(object: THREE.Object3D, instanceId: number = 0): void {
    this.deselectObject();
    this.selectedObject = object;
    this.selectedInstanceId = instanceId;

    // Update the shader so the user sees which one they clicked
    if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
      const material = object.material as THREE.ShaderMaterial;
      if (material && material.uniforms) {
        if (material.uniforms.uSelected) material.uniforms.uSelected.value = true;
        if (material.uniforms.uSelectedInstanceId) material.uniforms.uSelectedInstanceId.value = instanceId;
      }
    }

    this.attachTransformControls(object);
  }

  // Stop highlighting and remove the gizmo
  public deselectObject(): void {
    if (this.selectedObject) {
      const material = (this.selectedObject as THREE.Mesh).material as THREE.ShaderMaterial;
      if (material && material.uniforms) {
        if (material.uniforms.uSelected) material.uniforms.uSelected.value = false;
        if (material.uniforms.uSelectedInstanceId) material.uniforms.uSelectedInstanceId.value = -1.0;
      }
      this.detachTransformControls();
      this.selectedObject = null;
      this.selectedInstanceId = null;
    }
  }

  // Simple helper to poke a uniform value in a shader
  private updateShaderUniform(object: THREE.Object3D, uniformName: string, value: boolean): void {
    if (object instanceof THREE.Mesh) {
      const material = object.material as THREE.ShaderMaterial;
      if (material && material.uniforms[uniformName]) {
        material.uniforms[uniformName].value = value;
      }
    }
  }

  // Show the Three.js TransformControls so users can drag components around
  private attachTransformControls(object: THREE.Object3D): void {
    if (!this.transformControls) {
      this.transformControls = new TransformControls(this.camera, this.canvas);
      this.transformControls.addEventListener('change', () => {
        this.onTransformChange();
      });
    }

    this.transformControls.attach(object);

    // Keep it realistic: PCB components move on the board (XZ), not in the air (Y)
    this.transformControls.showY = false;
    this.transformControls.object = object;
    this.transformControls.setMode('translate');

    this.scene.add(this.transformControls);
  }

  // Remove the movement gizmo and free up memory
  private detachTransformControls(): void {
    if (this.transformControls) {
      this.transformControls.detach();
      this.scene.remove(this.transformControls);
      this.transformControls.dispose();
      this.transformControls = null;
    }
  }

  // Called whenever the user drags the transform handles
  private onTransformChange(): void {
    if (this.selectedObject && this.selectedInstanceId !== null && this.transformControls) {
      if (this.selectedObject instanceof THREE.InstancedMesh) {
        const position = new THREE.Vector3();
        if (this.transformControls.object) {
          this.transformControls.object.getWorldPosition(position);
        }

        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(position.x, position.y, position.z);

        // Update the specific copy of the object in GPU memory
        this.selectedObject.setMatrixAt(this.selectedInstanceId, matrix);
        this.selectedObject.instanceMatrix.needsUpdate = true;

        // Keep our data records in sync
        this.updatePadPosition(this.selectedObject, this.selectedInstanceId, position);
      }
    }
  }

  // Placeholder for real data synchronization logic
  private updatePadPosition(_object: THREE.Object3D, instanceId: number, position: THREE.Vector3): void {
    console.log(`User moved component ${instanceId} to:`, position);
  }

  public getSelectedObject(): THREE.Object3D | null {
    return this.selectedObject;
  }

  public getHoveredObject(): THREE.Object3D | null {
    return this.hoveredObject;
  }

  // Tell us which meshes should respond to the mouse
  public setInteractableObjects(objects: THREE.Object3D[]): void {
    this.interactableObjects = objects;
  }

  public getHoverInfo(): {
    object: THREE.Object3D | null;
    instanceId: number | null;
  } {
    return {
      object: this.hoveredObject,
      instanceId: this.hoveredInstanceId
    };
  }

  public isHovering(): boolean {
    return this.hoveredObject !== null && this.hoveredInstanceId !== null;
  }

  public getTransformControls(): TransformControls | null {
    return this.transformControls;
  }

  // Cleanup to avoid memory leaks when stopping the interaction system
  public dispose(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('click', this.onClick.bind(this));
    this.detachTransformControls();
  }
}
