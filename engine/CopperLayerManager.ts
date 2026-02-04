import * as THREE from 'three';

/**
 * The CopperLayerManager is our "Z-coordinate specialist".
 * Its only job is to calculate exactly where the copper should sit on the board
 * so we don't get that ugly flickering effect (Z-fighting) when two 3D surfaces 
 * are at the exact same height.
 */
export class CopperLayerManager {
  private boardThickness: number;

  // A tiny 0.01mm air gap makes sure the copper always renders "on top" of the board
  private readonly COPPER_OFFSET_MM = 0.01;

  constructor(boardThickness: number) {
    this.boardThickness = boardThickness;
  }

  // MATH: Top copper Z = Half the board thickness + a tiny nudge upwards
  public getTopCopperZ(): number {
    return +(this.boardThickness / 2) + this.COPPER_OFFSET_MM;
  }

  // MATH: Bottom copper Z = Half the board thickness (negative) + a tiny nudge downwards
  public getBottomCopperZ(): number {
    return -(this.boardThickness / 2) - this.COPPER_OFFSET_MM;
  }

  /**
   * Handy helper to create a piece of copper and automatically plop it 
   * onto the right layer at the right height.
   */
  public createCopperGeometry(
    geometry: THREE.BufferGeometry,
    layer: 'top' | 'bottom'
  ): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({
      color: 0xb87333, // High-quality copper color
      roughness: 0.7,
      metalness: 0.9,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Jump to the correct Z height immediately
    const targetZ = layer === 'top' ? this.getTopCopperZ() : this.getBottomCopperZ();
    mesh.position.y = targetZ;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  public createCopperPlane(
    width: number,
    height: number,
    x: number = 0,
    z: number = 0,
    layer: 'top' | 'bottom'
  ): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = this.createCopperGeometry(geometry, layer);

    mesh.position.set(x, mesh.position.y, z);
    // Rotate 90 degrees so it lays flat against the PCB surface
    mesh.rotation.x = -Math.PI / 2;

    return mesh;
  }

  public updateBoardThickness(newThickness: number): void {
    this.boardThickness = newThickness;
  }

  public getBoardThickness(): number {
    return this.boardThickness;
  }

  /**
   * Sanity check to ensure there's enough space between the copper and the substrate.
   */
  public validateZSeparation(): boolean {
    const topZ = this.getTopCopperZ();
    const boardTop = this.boardThickness / 2;
    const separation = Math.abs(topZ - boardTop);

    return separation >= this.COPPER_OFFSET_MM;
  }

  // Debugging info
  public getLayerInfo(): {
    boardThickness: number;
    topCopperZ: number;
    bottomCopperZ: number;
    copperOffset: number;
    zSeparationValid: boolean;
  } {
    return {
      boardThickness: this.boardThickness,
      topCopperZ: this.getTopCopperZ(),
      bottomCopperZ: this.getBottomCopperZ(),
      copperOffset: this.COPPER_OFFSET_MM,
      zSeparationValid: this.validateZSeparation()
    };
  }
}
