import * as THREE from 'three';
import { FlatTraces, TraceData } from './FlatTraces';

/**
 * The TraceManager is the high-level API for working with the Board's traces.
 * It handles adding, clearing, and providing demo data for the trace system.
 */
export class TraceManager {
  private flatTraces: FlatTraces;

  constructor(scene: THREE.Scene, copperLayerManager: unknown) {
    // We can handle up to 5000 segments out of the box
    this.flatTraces = new FlatTraces(copperLayerManager, scene, 5000);
  }

  public addTrace(traceData: TraceData): boolean {
    return this.flatTraces.addTrace(traceData);
  }

  public getAllTraces(): TraceData[] {
    return this.flatTraces.getAllTraces();
  }

  public clearAll(): void {
    this.flatTraces.clear();
  }

  public calculateTraceArea(traceId: string): number {
    return this.flatTraces.calculateTraceArea(traceId);
  }

  public calculateTraceLength(traceId: string): number {
    return this.flatTraces.calculateTraceLength(traceId);
  }

  // Returns the actual instanced mesh for the interaction system to pick up
  public getTraceMeshes(): THREE.InstancedMesh[] {
    return [this.flatTraces.instancedMesh];
  }

  // Maps a 3D click back to our internal trace data records
  public getTraceByMesh(mesh: THREE.Mesh, instanceId?: number): TraceData | null {
    if (mesh !== this.flatTraces.instancedMesh || instanceId === undefined) return null;
    const traceId = this.flatTraces.getTraceIdByInstanceId(instanceId);
    if (!traceId) return null;
    return this.flatTraces.traces.get(traceId) || null;
  }

  /**
   * Generates a realistic set of traces to show off how fast the engine is.
   */
  public initializeDemo(): void {
    const demoTraces: TraceData[] = [
      {
        id: 'trace_demo_1',
        points: [new THREE.Vector3(-40, -20, 0), new THREE.Vector3(0, -20, 0), new THREE.Vector3(0, 20, 0)] as any,
        width: 0.6,
        layer: 'top'
      },
      {
        id: 'trace_demo_2',
        points: [new THREE.Vector2(10, 30), new THREE.Vector2(40, 30), new THREE.Vector2(40, -10)],
        width: 1.2,
        layer: 'bottom'
      }
    ];

    // Let's create a bunch of random "noise" traces to stress-test the renderer
    for (let i = 0; i < 50; i++) {
      const x = (i % 10 - 5) * 8;
      const z = (Math.floor(i / 10) - 2) * 15;
      demoTraces.push({
        id: `auto_trace_${i}`,
        points: [new THREE.Vector2(x, z), new THREE.Vector2(x + 5, z + 5)],
        width: 0.4 + Math.random() * 0.4,
        layer: i % 2 === 0 ? 'top' : 'bottom'
      });
    }

    demoTraces.forEach(t => this.addTrace(t));
    console.log(`📡 Trace system initialized with ${demoTraces.length} paths.`);
  }

  public dispose(): void {
    this.flatTraces.dispose();
  }
}
