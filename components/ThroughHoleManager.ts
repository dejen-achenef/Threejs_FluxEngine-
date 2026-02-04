import * as THREE from 'three';
import { ThroughHoles, ThroughHoleData } from './ThroughHoles';
import { CopperLayerManager } from '../engine/CopperLayerManager';

/**
 * The ThroughHoleManager handles all the "drilling" in our PCB.
 * It manages both tiny vias and larger component mounting holes.
 */
export class ThroughHoleManager {
    private holes: ThroughHoles;
    private scene: THREE.Scene;
    private copperLayerManager: CopperLayerManager;

    constructor(scene: THREE.Scene, copperLayerManager: CopperLayerManager) {
        this.scene = scene;
        this.copperLayerManager = copperLayerManager;
        this.holes = new ThroughHoles(copperLayerManager);

        // Add the hole meshes (and their outlines) to the stage
        this.scene.add(this.holes.instancedMesh);
        this.scene.add(this.holes.edgeMesh);
    }

    public getEdgeMesh(): THREE.InstancedMesh {
        return this.holes.edgeMesh;
    }

    /**
     * Drills a hole at a specific (X, Z) coordinate.
     */
    public addHole(id: string, x: number, z: number, diameter: number): boolean {
        const thickness = this.copperLayerManager.getBoardThickness();
        const holeData: ThroughHoleData = {
            id,
            position: new THREE.Vector3(x, 0, z),
            diameter,
            // We make the hole 0.1mm longer than the board so it "pokes through"
            // perfectly without any weird flickering (Z-fighting).
            depth: thickness + 0.1
        };

        return this.holes.addHole(holeData);
    }

    public addVia(id: string, position: THREE.Vector3, diameter: number): void {
        this.addHole(id, position.x, position.z, diameter);
    }

    /**
     * Sets up a neat grid of vias to show off the system.
     */
    public initializeDemo(): void {
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                this.addHole(
                    `via_${i}_${j}`,
                    (i - 2) * 10,
                    (j - 2) * 10,
                    0.8
                );
            }
        }

        console.log('✅ Drilled 25 demo vias into the board.');
    }

    public getInstancedMesh(): THREE.InstancedMesh {
        return this.holes.instancedMesh;
    }

    public getAllHoles(): ThroughHoleData[] {
        return this.holes.getAllHoles();
    }

    public clearAll(): void {
        this.holes.clear();
    }

    public dispose(): void {
        this.scene.remove(this.holes.instancedMesh);
        this.holes.dispose();
    }
}
