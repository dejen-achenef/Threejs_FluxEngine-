import * as THREE from 'three';
import { CopperShader } from '../shaders/CopperShader';
import { CopperLayerManager } from '../engine/CopperLayerManager';

/**
 * The Board class represents the physical green substrate (the "PCB").
 * It manages the size, thickness, and the virtual layers where copper is placed.
 */
export class Board {
  public mesh!: THREE.Mesh;
  public topCopperLayer!: THREE.Object3D;
  public bottomCopperLayer!: THREE.Object3D;

  public static readonly DEFAULT_THICKNESS = 1.6;
  public static readonly SUBSTRATE_COLOR = 0x1a3a2a; // More vibrant, premium PCB green

  private width: number;
  private height: number;
  private thickness: number;
  private copperLayerManager: CopperLayerManager;

  constructor(width: number = 100, height: number = 80, thickness: number = 1.6) {
    this.width = width;
    this.height = height;
    this.thickness = thickness;

    // The manager helps us offset copper so it doesn't flicker against the green board
    this.copperLayerManager = new CopperLayerManager(thickness);

    this.createBoardSubstrate();
    this.createCopperLayers();
  }

  // Creates the main green block that represents the board material (FR4)
  private createBoardSubstrate(): void {
    const geometry = new THREE.BoxGeometry(this.width, this.thickness, this.height);

    const material = new THREE.MeshPhysicalMaterial({
      color: Board.SUBSTRATE_COLOR, // Classic dark green FR4 substrate
      roughness: 0.8,
      metalness: 0.0,
      clearcoat: 0.1,
      clearcoatRoughness: 0.8,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'pcb_board';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    this.mesh.position.set(0, 0, 0);
  }

  // Sets up the virtual "containers" for the top and bottom copper layers
  private createCopperLayers(): void {
    this.topCopperLayer = new THREE.Object3D();
    this.topCopperLayer.name = 'top_copper_layer';

    this.bottomCopperLayer = new THREE.Object3D();
    this.bottomCopperLayer.name = 'bottom_copper_layer';

    // We use precise Y offsets to prevent "Z-fighting" (flickering textures)
    this.topCopperLayer.position.y = this.copperLayerManager.getTopCopperZ();
    this.bottomCopperLayer.position.y = this.copperLayerManager.getBottomCopperZ();

    // Attach layers directly to the board so they move with it
    this.mesh.add(this.topCopperLayer);
    this.mesh.add(this.bottomCopperLayer);
  }

  /**
   * Places a flat piece of copper onto one of the board layers.
   */
  public addCopperPlane(layer: 'top' | 'bottom', width: number, height: number, x: number, z: number): THREE.Mesh {
    const copperMesh = this.copperLayerManager.createCopperPlane(width, height, x, z, layer);

    try {
      const shaderMaterial = CopperShader.createMaterial();
      // Help the GPU figure out which surface is "on top" to avoid flickering
      shaderMaterial.polygonOffset = true;
      shaderMaterial.polygonOffsetFactor = 1;
      shaderMaterial.polygonOffsetUnits = 1;
      copperMesh.material = shaderMaterial;
    } catch (error) {
      console.warn('I couldn\'t find the CopperShader, so I\'m falling back to standard materials.');
    }

    const targetLayer = layer === 'top' ? this.topCopperLayer : this.bottomCopperLayer;
    targetLayer.add(copperMesh);

    return copperMesh;
  }

  /**
   * Creates a "ground plane" that covers almost the entire surface of a layer.
   */
  public createCopperPour(layer: 'top' | 'bottom'): THREE.Mesh {
    const pourWidth = this.width - 2;
    const pourHeight = this.height - 2;

    return this.addCopperPlane(layer, pourWidth, pourHeight, 0, 0);
  }

  public getDimensions(): { width: number; height: number; thickness: number } {
    return {
      width: this.width,
      height: this.height,
      thickness: this.thickness
    };
  }

  /**
   * Resizes the board and realigns all the copper layers automatically.
   */
  public updateDimensions(width: number, height: number, thickness?: number): void {
    this.width = width;
    this.height = height;
    if (thickness !== undefined) {
      this.thickness = thickness;
      this.copperLayerManager.updateBoardThickness(thickness);
    }

    const newGeometry = new THREE.BoxGeometry(this.width, this.thickness, this.height);
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    this.topCopperLayer.position.y = this.copperLayerManager.getTopCopperZ();
    this.bottomCopperLayer.position.y = this.copperLayerManager.getBottomCopperZ();
  }

  public getTopCopperZ(): number {
    return this.copperLayerManager.getTopCopperZ();
  }

  public getBottomCopperZ(): number {
    return this.copperLayerManager.getBottomCopperZ();
  }

  public getCopperLayerManager(): CopperLayerManager {
    return this.copperLayerManager;
  }

  public getCopperElements(layer: 'top' | 'bottom'): THREE.Mesh[] {
    const targetLayer = layer === 'top' ? this.topCopperLayer : this.bottomCopperLayer;
    const elements: THREE.Mesh[] = [];

    targetLayer.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        elements.push(child);
      }
    });

    return elements;
  }

  // Deletes all board assets and notifies the GPU to free the memory
  public dispose(): void {
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }

    this.disposeCopperLayer(this.topCopperLayer);
    this.disposeCopperLayer(this.bottomCopperLayer);
    console.log('Board resources disposed.');
  }

  private disposeCopperLayer(layer: THREE.Object3D): void {
    layer.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    layer.clear();
  }
}
