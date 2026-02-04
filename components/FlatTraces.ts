import * as THREE from 'three';
import { InstancedHoverShader } from '../shaders/InstancedHoverShader';

/**
 * Traces are the "wires" on a PCB.
 * Since a single trace can have many segments, we use a single InstancedMesh
 * to draw EVERY segment of EVERY trace in one single go. This keeps our 
 * frame rate silky smooth regardless of how complex the routing is.
 */
export interface TraceData {
  id: string;
  points: THREE.Vector2[];
  width: number;
  layer: 'top' | 'bottom';
  name?: string;
}

export interface TraceSegment {
  startPoint: THREE.Vector2;
  endPoint: THREE.Vector2;
  width: number;
  angle: number;
  length: number;
  instanceId: number;
}

export class FlatTraces {
  public traces: Map<string, TraceData> = new Map();
  public traceSegments: Map<string, TraceSegment[]> = new Map();
  public instancedMesh: THREE.InstancedMesh;

  private maxInstances: number;
  private instanceCount: number = 0;
  private scene: THREE.Scene;

  constructor(_copperLayerManager: unknown, scene: THREE.Scene, maxInstances: number = 5000) {
    this.scene = scene;
    this.maxInstances = maxInstances;

    // We start with a tiny 1x1 unit square and then stretch it to the right 
    // length and width for each segment using the instance matrix.
    const baseGeometry = this.createUnitSegmentGeometry();

    const material = InstancedHoverShader.createMaterial({
      baseColor: new THREE.Color(0xb87333), // Realistic copper tint
      edgeColor: new THREE.Color(0x111111),
      edgeWidth: 2.0
    });

    this.instancedMesh = new THREE.InstancedMesh(baseGeometry, material, this.maxInstances);
    this.instancedMesh.name = 'flat_traces_instanced';
    // DynamicDrawUsage tells the GPU we might be moving these things around often
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.frustumCulled = true;

    this.scene.add(this.instancedMesh);
  }

  // Just a simple flat square geometry centered at the origin
  private createUnitSegmentGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.5, 0, -0.5,
      0.5, 0, -0.5,
      0.5, 0, 0.5,
      -0.5, 0, 0.5,
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const barycentrics = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1]);
    const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
  }

  /**
   * Breaks a trace path into individual straight segments and 
   * uploads their transformations to the GPU.
   */
  public addTrace(traceData: TraceData): boolean {
    const points = traceData.points;
    const segments: TraceSegment[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      if (this.instanceCount >= this.maxInstances) break;

      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dz = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);

      const instanceId = this.instanceCount++;

      const segment: TraceSegment = {
        startPoint: p1,
        endPoint: p2,
        width: traceData.width,
        angle,
        length,
        instanceId
      };

      // We calculate the math to move, rotate, and scale our unit square 
      // into a trace segment of the perfect size.
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3((p1.x + p2.x) / 2, traceData.layer === 'top' ? 0.01 : -0.01, (p1.y + p2.y) / 2);
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      const scale = new THREE.Vector3(length, 1.0, traceData.width);

      matrix.compose(position, rotation, scale);
      this.instancedMesh.setMatrixAt(instanceId, matrix);
      segments.push(segment);
    }

    this.traces.set(traceData.id, traceData);
    this.traceSegments.set(traceData.id, segments);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.instancedMesh.count = this.instanceCount;

    return true;
  }

  public clear(): void {
    this.instanceCount = 0;
    this.instancedMesh.count = 0;
    this.traces.clear();
    this.traceSegments.clear();
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Works out the total surface area covered by all segments of a trace.
   */
  public calculateTraceArea(traceId: string): number {
    const segments = this.traceSegments.get(traceId) || [];
    return segments.reduce((acc, s) => acc + (s.length * s.width), 0);
  }

  /**
   * Sums up the distance of every straight section in a trace path.
   */
  public calculateTraceLength(traceId: string): number {
    const segments = this.traceSegments.get(traceId) || [];
    return segments.reduce((acc, s) => acc + s.length, 0);
  }

  public getAllTraces(): TraceData[] {
    return Array.from(this.traces.values());
  }

  public getTraceByMesh(mesh: THREE.Mesh): TraceData | null {
    if (mesh !== this.instancedMesh) return null;
    return null;
  }

  // Reverse lookup to find which trace data is at a specific GPU instance slot
  public getTraceIdByInstanceId(instanceId: number): string | null {
    for (const [id, segments] of this.traceSegments.entries()) {
      if (segments.some(s => s.instanceId === instanceId)) return id;
    }
    return null;
  }

  public dispose(): void {
    this.instancedMesh.geometry.dispose();
    if (this.instancedMesh.material instanceof THREE.Material) {
      this.instancedMesh.material.dispose();
    }
    this.scene.remove(this.instancedMesh);
  }
}
