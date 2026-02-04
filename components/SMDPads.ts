import * as THREE from 'three';
import { CopperLayerManager } from '../engine/CopperLayerManager';
import { ShaderManager } from '../shaders/ShaderManager';
import { BarycentricShader } from '../shaders/BarycentricShader';
import { BarycentricGeometry } from '../utils/BarycentricGeometry';
import { InstancedHoverShader } from '../shaders/InstancedHoverShader';

/**
 * SMDPads handles the heavy lifting of rendering thousands of pads efficiently.
 * It uses "GPU Instancing", which means we send one piece of geometry to the graphics 
 * card and then tell it to draw it many times at different locations and sizes.
 */

export interface SMDDPadData {
  id: string;
  type: 'rect' | 'circle';
  position: THREE.Vector3;
  size: THREE.Vector2;
  rotation: number; // In radians
  layer: 'top' | 'bottom';
}

export class SMDPads {
  public instancedMesh: THREE.InstancedMesh;
  public edgeMesh: THREE.InstancedMesh; // Used for those nice sharp outlines
  public padData: Map<string, SMDDPadData>;

  private copperLayerManager: CopperLayerManager;
  private maxInstances: number;
  private instanceCount: number = 0;

  // We reuse these temp objects to avoid creating new variables every frame (good for GC)
  private matrix: THREE.Matrix4;
  private tempVector: THREE.Vector3;
  private tempQuaternion: THREE.Quaternion;
  private tempEuler: THREE.Euler;

  // Cache geometries so we don't recreate them constantly
  private rectangularGeometry!: THREE.PlaneGeometry;
  private circularGeometry!: THREE.CircleGeometry;
  private rectangularEdgeGeometry!: THREE.PlaneGeometry;
  private circularEdgeGeometry!: THREE.CircleGeometry;

  constructor(copperLayerManager: CopperLayerManager, maxInstances: number = 1000) {
    this.copperLayerManager = copperLayerManager;
    this.maxInstances = maxInstances;
    this.padData = new Map();

    ShaderManager.getInstance();

    this.matrix = new THREE.Matrix4();
    this.tempVector = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempEuler = new THREE.Euler();

    this.createGeometries();

    // This is the main "copper" mesh
    this.instancedMesh = new THREE.InstancedMesh(
      this.rectangularGeometry,
      InstancedHoverShader.createMaterial({
        baseColor: new THREE.Color(0xb87333),
        edgeColor: new THREE.Color(0x000000),
        edgeWidth: 1.5
      }),
      this.maxInstances
    );

    this.instancedMesh.name = 'smd_pads';
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;

    // This is a separate layer just for the black borders around the pads
    this.edgeMesh = new THREE.InstancedMesh(
      this.rectangularEdgeGeometry,
      BarycentricShader.createMaterial({
        edgeColor: new THREE.Color(0x000000),
        edgeWidth: 1.5,
        opacity: 0.8
      }),
      this.maxInstances
    );

    this.edgeMesh.name = 'smd_pad_edges';
  }

  // Create the "Master" geometries that we'll copy many times
  private createGeometries(): void {
    this.rectangularGeometry = new THREE.PlaneGeometry(1, 1);
    this.rectangularGeometry.rotateX(-Math.PI / 2);

    this.circularGeometry = new THREE.CircleGeometry(0.5, 32);
    this.circularGeometry.rotateX(-Math.PI / 2);

    // We use "Barycentric" geometry for edges because it allows the shader to find 
    // the borders of the shape without needing wireframes.
    this.rectangularEdgeGeometry = BarycentricGeometry.createBarycentricPlane(1, 1);
    this.rectangularEdgeGeometry.rotateX(-Math.PI / 2);

    this.circularEdgeGeometry = BarycentricGeometry.createBarycentricCircle(0.5, 32);
    this.circularEdgeGeometry.rotateX(-Math.PI / 2);
  }

  // Adds a single pad to the list and updates the GPU data
  public addPad(padData: SMDDPadData): boolean {
    if (this.instanceCount >= this.maxInstances) {
      console.warn('The board is full! We can\'t add any more pads.');
      return false;
    }

    this.padData.set(padData.id, padData);
    this.updateInstanceMatrix(padData, this.instanceCount);

    this.instanceCount++;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.instancedMesh.count = this.instanceCount;

    this.edgeMesh.setMatrixAt(this.instanceCount - 1, this.matrix.clone());
    this.edgeMesh.instanceMatrix.needsUpdate = true;
    this.edgeMesh.count = this.instanceCount;

    return true;
  }

  // Calculates exactly where and how big this specific copy should be
  private updateInstanceMatrix(padData: SMDDPadData, instanceId: number): void {
    const targetZ = padData.layer === 'top'
      ? this.copperLayerManager.getTopCopperZ()
      : this.copperLayerManager.getBottomCopperZ();

    this.tempVector.set(padData.position.x, targetZ, padData.position.z);
    this.tempEuler.set(0, padData.rotation, 0);
    this.tempQuaternion.setFromEuler(this.tempEuler);

    // We scale a "unit" shape by the actual dimensions the user wants
    const scale = new THREE.Vector3(padData.size.x, 1, padData.size.y);

    this.matrix.compose(this.tempVector, this.tempQuaternion, scale);
    this.instancedMesh.setMatrixAt(instanceId, this.matrix);
  }

  public addPads(padsArray: SMDDPadData[]): number {
    let addedCount = 0;
    padsArray.forEach(padData => {
      if (this.addPad(padData)) addedCount++;
    });
    return addedCount;
  }

  // Deleting in an InstancedMesh is tricky—we have to remove the item from 
  // our list and then rewrite the entire GPU buffer for all remaining items.
  public removePad(padId: string): boolean {
    if (!this.padData.has(padId)) return false;

    this.padData.delete(padId);
    this.rebuildInstances();

    return true;
  }

  // Refreshes the GPU buffers to match our internal Map
  private rebuildInstances(): void {
    this.instanceCount = 0;
    this.instancedMesh.count = 0;
    this.edgeMesh.count = 0;

    const remainingPads = Array.from(this.padData.values());
    this.padData.clear();

    remainingPads.forEach(padData => {
      this.addPad(padData);
    });
  }

  public getPad(padId: string): SMDDPadData | undefined {
    return this.padData.get(padId);
  }

  public getAllPads(): SMDDPadData[] {
    return Array.from(this.padData.values());
  }

  public getPadsByLayer(layer: 'top' | 'bottom'): SMDDPadData[] {
    return Array.from(this.padData.values()).filter(pad => pad.layer === layer);
  }

  public getPadsByType(type: 'rect' | 'circle'): SMDDPadData[] {
    return Array.from(this.padData.values()).filter(pad => pad.type === type);
  }

  // Updates a single pad's position without rebuilding the entire world
  public updatePadPosition(padId: string, newPosition: THREE.Vector3): boolean {
    const padData = this.padData.get(padId);
    if (!padData) return false;

    padData.position.copy(newPosition);

    const instanceId = this.getInstanceId(padId);
    if (instanceId !== -1) {
      this.updateInstanceMatrix(padData, instanceId);
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      return true;
    }

    return false;
  }

  // Finds where a pad lives in the GPU instance buffer
  private getInstanceId(padId: string): number {
    const pads = Array.from(this.padData.keys());
    return pads.indexOf(padId);
  }

  public updatePadSize(padId: string, newSize: THREE.Vector2): boolean {
    const padData = this.padData.get(padId);
    if (!padData) return false;

    padData.size.copy(newSize);

    const instanceId = this.getInstanceId(padId);
    if (instanceId !== -1) {
      this.updateInstanceMatrix(padData, instanceId);
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      return true;
    }

    return false;
  }

  public clear(): void {
    this.padData.clear();
    this.instanceCount = 0;
    this.instancedMesh.count = 0;
    this.edgeMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.edgeMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Returns the current number of pads displayed on the board.
   */
  public getPadCount(): number {
    return this.instanceCount;
  }

  public getStats(): {
    totalInstances: number;
    maxInstances: number;
    rectangularPads: number;
    circularPads: number;
    topLayerPads: number;
    bottomLayerPads: number;
  } {
    const pads = this.getAllPads();
    return {
      totalInstances: this.instanceCount,
      maxInstances: this.maxInstances,
      rectangularPads: pads.filter(p => p.type === 'rect').length,
      circularPads: pads.filter(p => p.type === 'circle').length,
      topLayerPads: pads.filter(p => p.layer === 'top').length,
      bottomLayerPads: pads.filter(p => p.layer === 'bottom').length
    };
  }

  // Changes the shader uniform to make a pad pulse when hovered
  public setPadHovered(padId: string, hovered: boolean): boolean {
    const padData = this.padData.get(padId);
    if (!padData) return false;

    const instanceId = this.getInstanceId(padId);
    if (instanceId === -1) return false;

    const material = this.instancedMesh.material as THREE.ShaderMaterial;
    if (hovered) {
      InstancedHoverShader.setHovered(material, true);
      InstancedHoverShader.setHoveredInstanceId(material, instanceId);
    } else {
      InstancedHoverShader.clearHover(material);
    }

    return true;
  }

  public setInstanceHovered(instanceId: number, hovered: boolean): boolean {
    if (instanceId < 0 || instanceId >= this.instanceCount) return false;

    const material = this.instancedMesh.material as THREE.ShaderMaterial;
    if (hovered) {
      InstancedHoverShader.setHovered(material, true);
      InstancedHoverShader.setHoveredInstanceId(material, instanceId);
    } else {
      InstancedHoverShader.clearHover(material);
    }

    return true;
  }

  public setPadSelected(padId: string, selected: boolean): boolean {
    const padData = this.padData.get(padId);
    if (!padData) return false;

    const material = this.instancedMesh.material as THREE.ShaderMaterial;
    InstancedHoverShader.setSelected(material, selected);

    return true;
  }

  public clearInteractionStates(): void {
    const material = this.instancedMesh.material as THREE.ShaderMaterial;
    InstancedHoverShader.clearHover(material);
    InstancedHoverShader.setSelected(material, false);
  }

  public getShaderMaterial(): THREE.ShaderMaterial {
    return this.instancedMesh.material as THREE.ShaderMaterial;
  }

  public getEdgeMaterial(): THREE.ShaderMaterial {
    return this.edgeMesh.material as THREE.ShaderMaterial;
  }

  public setEdgeVisible(visible: boolean): void {
    this.edgeMesh.visible = visible;
  }

  public setEdgeColor(color: THREE.Color): void {
    BarycentricShader.setEdgeColor(this.edgeMesh.material as THREE.ShaderMaterial, color);
  }

  public setEdgeWidth(width: number): void {
    BarycentricShader.setEdgeWidth(this.edgeMesh.material as THREE.ShaderMaterial, width);
  }

  public setEdgeOpacity(opacity: number): void {
    BarycentricShader.setOpacity(this.edgeMesh.material as THREE.ShaderMaterial, opacity);
  }

  public updateEdgeAnimation(time: number): void {
    BarycentricShader.updateMaterial(this.edgeMesh.material as THREE.ShaderMaterial, time);
  }

  public dispose(): void {
    this.rectangularGeometry.dispose();
    this.circularGeometry.dispose();
    this.rectangularEdgeGeometry.dispose();
    this.circularEdgeGeometry.dispose();

    if (this.instancedMesh.material instanceof THREE.Material) {
      this.instancedMesh.material.dispose();
    }
    if (this.edgeMesh.material instanceof THREE.Material) {
      this.edgeMesh.material.dispose();
    }

    this.padData.clear();
  }
}
