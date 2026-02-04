import * as THREE from 'three';
import { CopperShader } from './CopperShader';

/**
 * The ShaderManager is a central hub for all our custom PCB shaders.
 * It's a "Singleton," meaning there's only ever one copy of this manager,
 * and it handles the bookkeeping for animations and material creation.
 */
export class ShaderManager {
  private static instance: ShaderManager;
  private copperMaterial: THREE.ShaderMaterial;
  private clock: THREE.Clock;
  private animationId: number | null = null;

  private constructor() {
    this.clock = new THREE.Clock();
    // Start with a base, "Master" copper material
    this.copperMaterial = CopperShader.createMaterial();
    this.startAnimation();
  }

  /**
   * Handy way to grab the manager from anywhere in the codebase.
   */
  public static getInstance(): ShaderManager {
    if (!ShaderManager.instance) {
      ShaderManager.instance = new ShaderManager();
    }
    return ShaderManager.instance;
  }

  /**
   * Returns a copy of our signature copper material.
   * We clone it so that changing the color of one pad doesn't change them all!
   */
  public getCopperMaterial(): THREE.ShaderMaterial {
    return this.copperMaterial.clone();
  }

  public setHovered(material: THREE.ShaderMaterial, hovered: boolean): void {
    CopperShader.setHovered(material, hovered);
  }

  public setSelected(material: THREE.ShaderMaterial, selected: boolean): void {
    CopperShader.setSelected(material, selected);
  }

  public setBaseColor(material: THREE.ShaderMaterial, color: THREE.Color): void {
    CopperShader.setBaseColor(material, color);
  }

  /**
   * This internal loop keeps the "Time" uniform updated in the GPU.
   * That's what allows the materials to pulse when hovered.
   */
  private startAnimation(): void {
    const animate = () => {
      const time = this.clock.getElapsedTime();
      CopperShader.updateMaterial(this.copperMaterial, time);
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  public stopAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public dispose(): void {
    this.stopAnimation();
    this.copperMaterial.dispose();
  }

  /**
   * A helper for quickly creating a copper material with preset states.
   */
  public createCopperMaterial(options?: {
    baseColor?: THREE.Color;
    initialHovered?: boolean;
    initialSelected?: boolean;
  }): THREE.ShaderMaterial {
    const material = this.getCopperMaterial();

    if (options?.baseColor) {
      this.setBaseColor(material, options.baseColor);
    }

    if (options?.initialHovered) {
      this.setHovered(material, options.initialHovered);
    }

    if (options?.initialSelected) {
      this.setSelected(material, options.initialSelected);
    }

    return material;
  }

  // Handy for updating a whole bunch of pads at once
  public updateMaterials(materials: THREE.ShaderMaterial[], updates: {
    hovered?: boolean;
    selected?: boolean;
    baseColor?: THREE.Color;
  }): void {
    materials.forEach(material => {
      if (updates.hovered !== undefined) {
        this.setHovered(material, updates.hovered);
      }
      if (updates.selected !== undefined) {
        this.setSelected(material, updates.selected);
      }
      if (updates.baseColor) {
        this.setBaseColor(material, updates.baseColor);
      }
    });
  }
}
