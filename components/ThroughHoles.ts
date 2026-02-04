import * as THREE from 'three';
import { CopperLayerManager } from '../engine/CopperLayerManager';
import { InstancedHoverShader } from '../shaders/InstancedHoverShader';

/**
 * ThroughHoles is the low-level system for rendering cylinder-shaped cutouts in the board.
 * Like our other components, it uses InstancedMesh so we can draw thousands of holes
 * in one single GPU draw call.
 */
export interface ThroughHoleData {
    id: string;
    position: THREE.Vector3;
    diameter: number;
    depth: number;
}

export class ThroughHoles {
    public instancedMesh: THREE.InstancedMesh;
    public edgeMesh: THREE.InstancedMesh; // Outlines to make the holes pop
    public holeData: Map<string, ThroughHoleData>;

    private maxInstances: number;
    private instanceCount: number = 0;
    private matrix: THREE.Matrix4;
    private readonly RADIAL_SEGMENTS = 32;

    private holeGeometry!: THREE.CylinderGeometry;

    constructor(_copperLayerManager: CopperLayerManager, maxInstances: number = 2000) {
        this.maxInstances = maxInstances;
        this.holeData = new Map();
        this.matrix = new THREE.Matrix4();

        this.createGeometry();

        // We use our custom "Hover Shader" here too, so holes pulse when you mouse over them.
        const material = InstancedHoverShader.createMaterial({
            baseColor: new THREE.Color(0x111111), // Dark gray for the inside of the hole
            edgeColor: new THREE.Color(0x000000),
            edgeWidth: 2.0
        });

        this.instancedMesh = new THREE.InstancedMesh(this.holeGeometry, material, this.maxInstances);
        this.instancedMesh.name = 'through_holes';
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // A wireframe-style overlay for the hole boundaries
        this.edgeMesh = new THREE.InstancedMesh(
            this.holeGeometry,
            new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.3 }),
            this.maxInstances
        );
        this.edgeMesh.name = 'through_hole_edges';
    }

    // Creates the "Master Hole" that we'll copy everywhere
    private createGeometry(): void {
        this.holeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, this.RADIAL_SEGMENTS, 1, true);

        // We add "Barycentric" coordinates so our custom shader knows 
        // exactly where the edges of the cylinder are.
        const count = this.holeGeometry.attributes.position.count;
        const barycentrics = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            barycentrics[i * 3 + (i % 3)] = 1;
        }
        this.holeGeometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));
    }

    /**
     * Places a hole and updates the GPU transformation matrix.
     */
    public addHole(data: ThroughHoleData): boolean {
        if (this.instanceCount >= this.maxInstances) return false;

        this.holeData.set(data.id, data);
        const position = new THREE.Vector3(data.position.x, 0, data.position.z);
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3(data.diameter, data.depth, data.diameter);

        this.matrix.compose(position, rotation, scale);
        this.instancedMesh.setMatrixAt(this.instanceCount, this.matrix);
        this.edgeMesh.setMatrixAt(this.instanceCount, this.matrix);

        this.instanceCount++;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.edgeMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.count = this.instanceCount;
        this.edgeMesh.count = this.instanceCount;

        return true;
    }

    public clear(): void {
        this.holeData.clear();
        this.instanceCount = 0;
        this.instancedMesh.count = 0;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Returns a list of all defined through-holes.
     */
    public getAllHoles(): ThroughHoleData[] {
        return Array.from(this.holeData.values());
    }

    public dispose(): void {
        this.holeGeometry.dispose();
        if (this.instancedMesh.material instanceof THREE.Material) {
            this.instancedMesh.material.dispose();
        }
        this.holeData.clear();
    }
}
