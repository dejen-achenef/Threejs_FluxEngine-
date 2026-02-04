import * as THREE from 'three';
import { SMDPads, SMDDPadData } from './SMDPads';
import { CopperLayerManager } from '../engine/CopperLayerManager';

/**
 * The SMDPadManager is like a high-level controller for all the solder pads.
 * It's easier to use this class than to talk to the raw instancing engine directly.
 */
export class SMDPadManager {
  private smdPads: SMDPads;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, copperLayerManager: CopperLayerManager) {
    this.scene = scene;

    // We build the actual instancing system here
    this.smdPads = new SMDPads(copperLayerManager, 1000);

    // Attach the pads and their black outlines to the scene
    this.scene.add(this.smdPads.instancedMesh);
    this.scene.add(this.smdPads.edgeMesh);
  }

  /**
   * Plopping down over 100 pads automatically so the board doesn't look empty.
   */
  public initializeDemo(): void {
    console.log('Generating a demo pad layout...');

    const demoPads: SMDDPadData[] = [];
    for (let i = 0; i < 120; i++) {
      const row = Math.floor(i / 12);
      const col = i % 12;
      demoPads.push({
        id: `demo_pad_${i}`,
        type: i % 2 === 0 ? 'rect' : 'circle',
        // Space them out in a grid
        position: new THREE.Vector3((col - 5.5) * 6, 0, (row - 4.5) * 6),
        size: new THREE.Vector2(2, 2),
        // Put half on top and half on bottom
        layer: row < 5 ? 'top' : 'bottom',
        rotation: (i % 4) * Math.PI / 4
      });
    }

    this.smdPads.addPads(demoPads);
    console.log(`✅ Demo populated with ${demoPads.length} pads.`);
  }

  // Basic CRUD operations for pads
  public addPad(padData: SMDDPadData): boolean {
    return this.smdPads.addPad(padData);
  }

  public addPads(padsArray: SMDDPadData[]): number {
    return this.smdPads.addPads(padsArray);
  }

  public removePad(padId: string): boolean {
    return this.smdPads.removePad(padId);
  }

  public clearAll(): void {
    this.smdPads.clear();
  }

  public getPad(padId: string): SMDDPadData | undefined {
    return this.smdPads.getPad(padId);
  }

  public getAllPads(): SMDDPadData[] {
    return this.smdPads.getAllPads();
  }

  public getPadsByLayer(layer: 'top' | 'bottom'): SMDDPadData[] {
    return this.smdPads.getPadsByLayer(layer);
  }

  public updatePadPosition(padId: string, newPosition: THREE.Vector3): boolean {
    return this.smdPads.updatePadPosition(padId, newPosition);
  }

  // Returns the raw meshes used for rendering (needed for raycasting)
  public getMeshes(): THREE.InstancedMesh[] {
    return [this.smdPads.instancedMesh, this.smdPads.edgeMesh];
  }

  // Helper to figure out which specific pad data belongs to a 3D intersection
  public getPadByMesh(mesh: THREE.Mesh, instanceId: number): SMDDPadData | null {
    if (mesh === this.smdPads.instancedMesh || mesh === this.smdPads.edgeMesh) {
      const pads = this.getAllPads();
      return pads[instanceId] || null;
    }
    return null;
  }

  // Geometry math for the inspector sidebar
  public calculatePadArea(padId: string): number {
    const pad = this.getPad(padId);
    if (!pad) return 0;
    if (pad.type === 'rect') {
      return pad.size.x * pad.size.y;
    } else {
      return Math.PI * (pad.size.x / 2) * (pad.size.x / 2);
    }
  }

  public dispose(): void {
    this.scene.remove(this.smdPads.instancedMesh);
    this.scene.remove(this.smdPads.edgeMesh);
    this.smdPads.dispose();
  }
}
