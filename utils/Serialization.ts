import * as THREE from 'three';
import { Board } from '../components/Board';
import { TraceData } from '../components/FlatTraces';
import { SMDPadManager } from '../components/SMDPadManager';
import { TraceManager } from '../components/TraceManager';
import { ThroughHoleManager } from '../components/ThroughHoleManager';

/**
 * These interfaces define what a PCB "save file" looks like.
 * We're basically taking a snapshot of the board plus all our pads and traces.
 */
export interface PCBBoardData {
  board: {
    width: number;
    height: number;
    thickness: number;
  };
  components: PCBComponentData[];
  metadata?: {
    version: string;
    created: string;
    modified: string;
    description?: string;
  };
}

export interface PCBComponentData {
  id: string;
  type: 'smd_rect' | 'smd_circle' | 'path' | 'drill';
  pos: [number, number, number];
  size?: [number, number];
  points?: [number, number][];
  width?: number;
  layer?: 'top' | 'bottom';
  rotation?: number;
  diameter?: number;
}

/**
 * Three.js doesn't automatically clean up after itself in the GPU.
 * This tracker helps us keep a manifest of every geometry and material we create
 * so we can kill them properly when they're no longer needed.
 */
interface ResourceTracker {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  meshes: Set<THREE.Mesh>;
  textures: Set<THREE.Texture>;
}

/**
 * Helper interface for components that own heavy assets
 */
interface TrackableComponent {
  instancedMesh?: THREE.Mesh;
  edgeMesh?: THREE.Mesh;
  rectangularGeometry?: THREE.BufferGeometry;
  circularGeometry?: THREE.BufferGeometry;
  rectangularEdgeGeometry?: THREE.BufferGeometry;
  circularEdgeGeometry?: THREE.BufferGeometry;
  traceMeshes?: Map<string, THREE.Mesh>;
  geometryCache?: Map<number, THREE.BufferGeometry>;
}

/**
 * This system is like the "Save/Load" manager for our application.
 * It translates live 3D objects into clean JSON data and back again,
 * while being extremely careful about memory usage.
 */
export class Serialization {
  public static readonly CURRENT_VERSION = '1.0.0';
  public static readonly DEFAULT_CREATOR = 'QuantumPCB Engine';

  private static resourceTracker: ResourceTracker = {
    geometries: new Set(),
    materials: new Set(),
    meshes: new Set(),
    textures: new Set()
  };

  /**
   * Scans the current scene and pulls out all the important data to save.
   */
  public static exportBoard(
    board: Board,
    smdPadManager: SMDPadManager,
    traceManager: TraceManager,
    holeManager: ThroughHoleManager
  ): PCBBoardData {
    const boardDimensions = board.getDimensions();

    // Map all our SMD pads into a saveable format
    const smdPadComponents = smdPadManager.getAllPads().map(pad => ({
      id: pad.id,
      type: `smd_${pad.type}` as PCBComponentData['type'],
      pos: [pad.position.x, pad.position.y, pad.position.z] as [number, number, number],
      size: [pad.size.x, pad.size.y] as [number, number],
      layer: pad.layer as 'top' | 'bottom',
      rotation: pad.rotation || 0
    }));

    // Map all our traces (routing)
    const flatTraceComponents = traceManager.getAllTraces().map(trace => ({
      id: trace.id,
      type: 'path' as const,
      pos: [0, trace.layer === 'top' ? 0.01 : -0.01, 0] as [number, number, number],
      points: trace.points.map(p => [p.x, p.y] as [number, number]),
      width: trace.width,
      layer: trace.layer
    }));

    const holeComponents = holeManager.getAllHoles().map(hole => ({
      id: hole.id,
      type: 'drill' as const,
      pos: [hole.position.x, hole.position.y, hole.position.z] as [number, number, number],
      diameter: hole.diameter
    }));

    const totalComponents = smdPadComponents.length + flatTraceComponents.length + holeComponents.length;
    console.log(`📡 Exported ${totalComponents} components (${smdPadComponents.length} pads, ${flatTraceComponents.length} traces, ${holeComponents.length} holes).`);

    return {
      board: boardDimensions,
      components: [
        ...smdPadComponents,
        ...flatTraceComponents,
        ...holeComponents
      ]
    };
  }

  /**
   * Takes a JSON board state, wipes the screen, and rebuilds everything from scratch.
   */
  public static importBoard(
    data: PCBBoardData,
    board: Board,
    smdPadManager: SMDPadManager,
    traceManager: TraceManager,
    holeManager: ThroughHoleManager
  ): void {
    // Clear the slate first to avoid overlapping objects
    this.clearBoard(board, smdPadManager, traceManager, holeManager);

    // Resize the substrate mesh
    board.updateDimensions(data.board.width, data.board.height, data.board.thickness);

    // Reconstruct each component based on its type
    data.components.forEach(component => {
      if (component.type.startsWith('smd_')) {
        this.importSMDPad(component, smdPadManager);
      } else if (component.type === 'path') {
        this.importFlatTrace(component, traceManager);
      } else if (component.type === 'drill') {
        this.importDrill(component, holeManager);
      }
    });
  }

  // Re-creates a drilled hole from saved data
  private static importDrill(data: PCBComponentData, holeManager: ThroughHoleManager): void {
    if (data.type !== 'drill' || !data.diameter) return;
    holeManager.addHole(data.id, data.pos[0], data.pos[2], data.diameter);
  }

  // Re-creates an SMD pad (rectangular or circular)
  private static importSMDPad(data: PCBComponentData, smdPadManager: SMDPadManager): void {
    if (!data.type.startsWith('smd_') || !data.size) return;

    const padType = data.type.replace('smd_', '') as 'rect' | 'circle';
    const padData = {
      id: data.id,
      type: padType,
      position: new THREE.Vector3(...data.pos),
      size: new THREE.Vector2(...data.size),
      layer: (data.layer || 'top') as 'top' | 'bottom',
      rotation: data.rotation || 0
    };

    smdPadManager.addPad(padData);
  }

  // Re-creates a trace path
  private static importFlatTrace(data: PCBComponentData, traceManager: TraceManager): void {
    if (data.type !== 'path' || !data.points || !data.width) return;

    const traceData: TraceData = {
      id: data.id,
      points: data.points.map(p => new THREE.Vector2(...p)),
      width: data.width,
      layer: (data.layer || 'top') as 'top' | 'bottom'
    };

    traceManager.addTrace(traceData);
  }

  /**
   * Resets all component managers and marks their resources for disposal.
   */
  private static clearBoard(
    _board: Board,
    smdPadManager: SMDPadManager,
    traceManager: TraceManager,
    holeManager: ThroughHoleManager
  ): void {
    // Record assets before we lose the references to them
    this.trackResources(smdPadManager as unknown as TrackableComponent);
    this.trackResources(traceManager as unknown as TrackableComponent);
    this.trackResources(holeManager as unknown as TrackableComponent);

    // Wipe the data inside the managers
    smdPadManager.clearAll();
    traceManager.clearAll();
    holeManager.clearAll();
  }

  /**
   * Deep-dive into a component and find all hidden Three.js assets that need eventual disposal.
   */
  private static trackResources(component: TrackableComponent): void {
    if (!component) return;

    if (component.instancedMesh) {
      this.resourceTracker.meshes.add(component.instancedMesh as THREE.Mesh);
    }

    if (component.edgeMesh) {
      this.resourceTracker.meshes.add(component.edgeMesh as THREE.Mesh);
    }

    // Accumulate geometries
    if (component.rectangularGeometry) this.resourceTracker.geometries.add(component.rectangularGeometry);
    if (component.circularGeometry) this.resourceTracker.geometries.add(component.circularGeometry);
    if (component.rectangularEdgeGeometry) this.resourceTracker.geometries.add(component.rectangularEdgeGeometry);
    if (component.circularEdgeGeometry) this.resourceTracker.geometries.add(component.circularEdgeGeometry);

    // Accumulate materials
    if (component.instancedMesh?.material) {
      this.resourceTracker.materials.add(component.instancedMesh.material as THREE.Material);
    }
    if (component.edgeMesh?.material) {
      this.resourceTracker.materials.add(component.edgeMesh.material as THREE.Material);
    }

    // Scrape trace meshes if they exist
    if (component.traceMeshes) {
      component.traceMeshes.forEach((mesh: THREE.Mesh) => {
        this.resourceTracker.meshes.add(mesh);
        if (mesh.geometry) this.resourceTracker.geometries.add(mesh.geometry);
        if (mesh.material) {
          const material = mesh.material;
          if (Array.isArray(material)) {
            material.forEach(m => this.resourceTracker.materials.add(m));
          } else {
            this.resourceTracker.materials.add(material);
          }
        }
      });
    }

    // Scrape geometry caches
    if (component.geometryCache) {
      component.geometryCache.forEach((geometry: THREE.BufferGeometry) => {
        this.resourceTracker.geometries.add(geometry);
      });
    }
  }

  /**
   * This is the "Empty Trash" button for the GPU.
   * It takes everything we've tracked and tells Three.js to delete it from memory.
   */
  public static disposeResources(): void {
    this.resourceTracker.geometries.forEach(geometry => geometry.dispose());
    this.resourceTracker.geometries.clear();

    this.resourceTracker.materials.forEach(material => material.dispose());
    this.resourceTracker.materials.clear();

    this.resourceTracker.meshes.forEach(mesh => {
      mesh.geometry.dispose();
      if (mesh.material) {
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach(m => m.dispose());
        } else {
          material.dispose();
        }
      }
    });
    this.resourceTracker.meshes.clear();

    this.resourceTracker.textures.forEach(texture => texture.dispose());
    this.resourceTracker.textures.clear();

    console.log('🧹 Cleanup complete: GPU memory released.');
  }

  // Quick check to see how much junk we're holding onto
  public static getResourceStats(): {
    geometries: number;
    materials: number;
    meshes: number;
    textures: number;
  } {
    return {
      geometries: this.resourceTracker.geometries.size,
      materials: this.resourceTracker.materials.size,
      meshes: this.resourceTracker.meshes.size,
      textures: this.resourceTracker.textures.size
    };
  }

  /**
   * Sanity check for incoming data. We don't want to crash if someone gives us a bad file.
   */
  public static validateBoardData(data: unknown): data is PCBBoardData {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    if (!obj.board || typeof obj.board !== 'object') return false;
    const board = obj.board as Record<string, unknown>;
    if (typeof board.width !== 'number' ||
      typeof board.height !== 'number' ||
      typeof board.thickness !== 'number') return false;

    if (!Array.isArray(obj.components)) return false;

    for (const component of obj.components) {
      if (!this.validateComponentData(component)) return false;
    }

    return true;
  }

  // Checks if a single component's data is valid
  private static validateComponentData(data: unknown): data is PCBComponentData {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    if (typeof obj.id !== 'string' ||
      typeof obj.type !== 'string' ||
      !Array.isArray(obj.pos) ||
      obj.pos.length !== 3) return false;

    if (!obj.pos.every((p: unknown) => typeof p === 'number')) return false;

    if (obj.type.startsWith('smd_')) {
      if (typeof obj.layer !== 'string' || (obj.layer !== 'top' && obj.layer !== 'bottom')) return false;
      if (!Array.isArray(obj.size) || obj.size.length !== 2) return false;
      if (!obj.size.every((s: unknown) => typeof s === 'number')) return false;
    } else if (obj.type === 'path') {
      if (typeof obj.layer !== 'string' || (obj.layer !== 'top' && obj.layer !== 'bottom')) return false;
      if (typeof obj.width !== 'number') return false;
      if (!Array.isArray(obj.points) || obj.points.length < 2) return false;
    } else if (obj.type === 'drill') {
      if (typeof obj.diameter !== 'number') return false;
    } else {
      return false;
    }

    return true;
  }

  /**
   * Triggers a browser download of the PCB data.
   */
  public static downloadBoardData(data: PCBBoardData, filename: string = 'pcb_board.json'): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Orchestrates reading a file from the user's computer and turning it into a data object.
   */
  public static loadBoardFromFile(file: File): Promise<PCBBoardData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);

          if (!this.validateBoardData(data)) {
            reject(new Error('This file doesn\'t look like a valid PCB board.'));
            return;
          }

          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse the file. Is it valid JSON?'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Couldn\'t read the file. Are you sure it exists?'));
      };

      reader.readAsText(file);
    });
  }

  public static exportToString(
    board: Board,
    smdPadManager: SMDPadManager,
    traceManager: TraceManager,
    holeManager: ThroughHoleManager
  ): string {
    const data = this.exportBoard(board, smdPadManager, traceManager, holeManager);
    return JSON.stringify(data, null, 2);
  }

  public static importFromString(
    jsonString: string,
    board: Board,
    smdPadManager: SMDPadManager,
    traceManager: TraceManager,
    holeManager: ThroughHoleManager
  ): void {
    try {
      const data = JSON.parse(jsonString);

      if (!this.validateBoardData(data)) {
        throw new Error('Invalid PCB data.');
      }

      this.importBoard(data, board, smdPadManager, traceManager, holeManager);
    } catch (error) {
      throw new Error('Import failed.');
    }
  }
}
