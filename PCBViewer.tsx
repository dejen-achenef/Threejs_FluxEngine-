import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Engine } from './engine/Engine';
import { Board } from './components/Board';
import { SMDPadManager } from './components/SMDPadManager';
import { TraceManager } from './components/TraceManager';
import { ThroughHoleManager } from './components/ThroughHoleManager';
import { Serialization } from './utils/Serialization';

/**
 * Hey! This is the main entry point for the PCB Viewer. 
 * We're basically wrapping our custom Three.js engine inside a React component
 * so we can have a nice UI while keeping the heavy rendering logic separate.
 */
interface PCBViewerProps {
  width?: number;
  height?: number;
  thickness?: number;
}

export const PCBViewer: React.FC<PCBViewerProps> = ({
  width = 100,
  height = 80,
  thickness = 1.6
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const boardRef = useRef<Board | null>(null);
  const smdPadManagerRef = useRef<SMDPadManager | null>(null);
  const traceManagerRef = useRef<TraceManager | null>(null);
  const holeManagerRef = useRef<ThroughHoleManager | null>(null);

  // We use this state to show details in the sidebar when someone clicks a component
  const [selectedComponent, setSelectedComponent] = useState<{
    id: string;
    type: 'pad' | 'trace';
    position: THREE.Vector3;
    area: number;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    /**
     * We wait a tiny bit to make sure the canvas is actually ready in the DOM.
     * Then we kick off the Three.js engine and wire up all our managers.
     */
    setTimeout(() => {
      try {
        const engine = new Engine(canvas);
        engineRef.current = engine;
        engine.start();

        // Create the board substrate
        const board = new Board(width, height, thickness);
        boardRef.current = board;

        // Set up managers for different PCB elements
        const smdPadManager = new SMDPadManager(engine.scene.scene, board.getCopperLayerManager());
        smdPadManagerRef.current = smdPadManager;

        const traceManager = new TraceManager(engine.scene.scene, board.getCopperLayerManager());
        traceManagerRef.current = traceManager;

        const holeManager = new ThroughHoleManager(engine.scene.scene, board.getCopperLayerManager());
        holeManagerRef.current = holeManager;

        // Fill the board with some demo data so it doesn't look empty on start
        smdPadManager.initializeDemo();
        traceManager.initializeDemo();
        holeManager.initializeDemo();

        // Throw the board mesh into the scene
        engine.scene.addToLayer(board.mesh, 'board');

        /**
         * Here's where the magic happens for selection.
         * We check every 100ms what the interaction system has picked up.
         * It's a simple way to keep the UI in sync without complex event listeners.
         */
        const selectionInterval = setInterval(() => {
          const selected = engine.interaction.getSelectedObject();
          const hoverInfo = engine.interaction.getHoverInfo();

          if (selected && hoverInfo.instanceId !== null) {
            const instanceId = hoverInfo.instanceId;
            const objectName = selected.name;

            // Figure out if we clicked a pad, trace, or hole
            if (objectName.includes('pad')) {
              const pad = smdPadManager.getPadByMesh(selected as THREE.Mesh, instanceId);
              if (pad) {
                setSelectedComponent({
                  id: pad.id,
                  type: 'pad',
                  position: pad.position,
                  area: smdPadManager.calculatePadArea(pad.id)
                });
              }
            } else if (objectName.includes('trace')) {
              const trace = traceManager.getTraceByMesh(selected as THREE.Mesh, instanceId);
              if (trace) {
                setSelectedComponent({
                  id: trace.id,
                  type: 'trace',
                  position: new THREE.Vector3(trace.points[0].x, 0, trace.points[0].y),
                  area: traceManager.calculateTraceArea(trace.id)
                });
              }
            } else if (objectName.includes('hole')) {
              const holes = holeManager.getAllHoles();
              const hole = holes[instanceId];
              if (hole) {
                setSelectedComponent({
                  id: hole.id,
                  type: 'pad', // Drills are essentially circular pads for the inspector
                  position: hole.position,
                  area: Math.PI * (hole.diameter / 2) * (hole.diameter / 2)
                });
              }
            }
          } else if (!selected) {
            setSelectedComponent(null);
          }

          // Let the interaction system know which meshes it should care about
          const currentMeshes = [
            ...smdPadManager.getMeshes(),
            ...traceManager.getTraceMeshes(),
            holeManager.getInstancedMesh(),
            holeManager.getEdgeMesh()
          ];
          engine.interaction.setInteractableObjects(currentMeshes);

        }, 100);

        // Clean up everything when the component unmounts to prevent memory leaks
        return () => {
          clearInterval(selectionInterval);
          engine.dispose();
        };
      } catch (error) {
        console.error('Oops, something went wrong while loading the PCB viewer:', error);
      }
    }, 100);
  }, [width, height, thickness]);

  // Saves the current board state to a JSON file
  const exportBoard = () => {
    if (!boardRef.current || !smdPadManagerRef.current || !traceManagerRef.current || !holeManagerRef.current) return;
    const boardData = Serialization.exportBoard(
      boardRef.current,
      smdPadManagerRef.current,
      traceManagerRef.current,
      holeManagerRef.current
    );
    Serialization.downloadBoardData(boardData);
  };

  // Loads a board state from a JSON file and reconstructs the scene
  const importBoard = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !boardRef.current || !smdPadManagerRef.current || !traceManagerRef.current || !holeManagerRef.current) return;
    Serialization.loadBoardFromFile(file).then(data => {
      Serialization.importBoard(data, boardRef.current!, smdPadManagerRef.current!, traceManagerRef.current!, holeManagerRef.current!);
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#111', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />

      {/* This is our sidebar inspector */}
      <div style={{
        position: 'absolute', top: 20, right: 20, width: 280,
        background: 'rgba(20, 20, 20, 0.9)', color: 'white', padding: 20,
        borderRadius: 8, border: '1px solid #333', fontFamily: 'Inter, sans-serif'
      }}>
        <h3 style={{ marginTop: 0, color: '#4CAF50' }}>Board Inspector</h3>
        {selectedComponent ? (
          <div>
            <p><strong>ID:</strong> {selectedComponent.id}</p>
            <p><strong>Type:</strong> {selectedComponent.type}</p>
            <p><strong>World Coordinates:</strong> {selectedComponent.position.x.toFixed(1)}, {selectedComponent.position.z.toFixed(1)}</p>
            <p><strong>Surface Area:</strong> {selectedComponent.area.toFixed(2)} mm²</p>
          </div>
        ) : <p style={{ color: '#888' }}>Select a component to inspect</p>}
      </div>

      {/* These are the main control buttons */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        background: 'rgba(20, 20, 20, 0.9)', color: 'white', padding: 20,
        borderRadius: 8, border: '1px solid #333'
      }}>
        <h4 style={{ marginTop: 0 }}>System Controls</h4>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportBoard} style={{ padding: '8px 16px', cursor: 'pointer', background: '#2196F3', color: 'white', border: 'none', borderRadius: 4 }}>
            Export Layout
          </button>
          <label style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', borderRadius: 4, cursor: 'pointer' }}>
            Import Layout
            <input type="file" accept=".json" onChange={importBoard} style={{ display: 'none' }} />
          </label>
        </div>
        <p style={{ fontSize: '11px', color: '#888', marginTop: 15 }}>
          ● Instanced Rendering<br />
          ● Pixel-Perfect Hydration<br />
          ● Explicit Disposal
        </p>
      </div>
    </div>
  );
};
