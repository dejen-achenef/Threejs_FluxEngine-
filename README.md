#  QuantumPCB: A High-Speed 3D PCB Playground

Welcome to **QuantumPCB**! If you've ever tried building a 3D Printed Circuit Board (PCB) viewer in the browser and watched your frame rate drop or your textures flicker, this project is for you.

QuantumPCB is a professional-grade 3D visualization and editing engine built for speed, precision, and a "no-nonsense" approach to graphics. We've bypassed heavy abstractions to talk directly to the GPU, creating a workspace that feels snappy even with thousands of components on screen.

---

##  Our Philosophy: "Mechanical-First"

Most modern web apps hide the complexity of 3D graphics behind layers of React components. While that's great for simple scenes, it can be a nightmare for complex engineering tools. 

**QuantumPCB takes the opposite approach:**
*   **Vanilla Three.js**: We use the raw power of the Three.js library in an imperative style. This gives us total control over the rendering pipeline.
*   **Performance Over Convenience**: We don't use React Three Fiber (R3F). By keeping our rendering logic in pure TypeScript "Engine" classes, we avoid the overhead of the React reconciler during the animation loop.
*   **Zero "Z-Fighting"**: We've obsessed over the math to ensure that traces, pads, and boards never flicker against each other—a common issue in web-based CAD tools.

---

##  The Technical "Secret Sauce"

Here’s what makes QuantumPCB tick under the hood:

### 1. The Power of Instancing
Rendering 1,000 solder pads one-by-one is slow. QuantumPCB uses **GPU Instancing** (`InstancedMesh`). We send a single "master" geometry to the graphics card and tell it to draw it 1,000 times at different positions, rotations, and scales. 
*   **The Result**: Thousands of components rendered in a **single draw call**.
*   **The Feel**: Silky smooth 60 FPS scrolling and zooming.

### 2. Smart Procedural Shaders
We don't use high-resolution images for copper or fiberglass. Instead, we use custom **GLSL Shaders** to calculate the look of materials pixel-by-pixel.
*   **Brushed Copper**: Our shaders simulate the tiny micro-scratches and reflections of real copper surfaces.
*   **Interactive Glow**: When you hover over a trace or pad, we don't swap out materials (which is slow). We just change a "uniform" value in the shader, making the highlight pulse instantly.

### 3. Precision Depth Management
PCBs are thin. In 3D space, being "thin" often leads to flickering because the GPU can't decide which surface is on top. We solve this with:
*   **Physical Offsets**: A literal 0.01mm gap between layers.
*   **GPU Polygon Offsets**: A backup rendering hint that tells the GPU to prioritize the copper over the substrate.

### 4. Memory Leak Prevention
WebApps that use WebGL are notorious for eating up RAM. QuantumPCB features an **Explicit Disposal System**. When you close the viewer or load a new board, every geometry, material, and texture is manually cleared from GPU memory. No zombies allowed.

---

##  Getting Around the Codebase

The project is organized so that the 3D logic and the UI logic stay in their own lanes:

*   **`/engine`**: The "Heart." Contains the Renderer, Scene, Camera, and the `Interaction` system that handles clicking and dragging.
*   **`/components`**: The "Body." High-level managers for the Board, SMD Pads, Traces, and Through-holes.
*   **`/shaders`**: The "Skin." Our custom GLSL code for copper effects and sharp edge outlines.
*   **`/utils`**: The "Memory." Contains the `Serialization` system for saving/loading your boards to JSON.
*   **`PCBViewer.tsx`**: The "Face." The main React component that brings everything together and provides the UI sidebar.

---

##  How to Get Running

Setting up is as simple as any modern web project:

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the development server**:
    ```bash
    npm run dev
    ```
3.  **Open your browser**: Head to the local URL (usually `localhost:5173`) and start playing with the 3D board.

> **💡 Quick Tip**: If you're seeing performance stutters, ensure your browser is using Hardware Acceleration in settings!

---

##  How to Use the Demo

*   **Navigate**: Use your **Left Mouse** to orbit, **Right Mouse** to pan, and **Scroll** to zoom in on those tiny traces.
*   **Inspect**: Hover your mouse over any pad or trace to see it pulse. Click on it to see its details (ID, Area, Position) pop up in the **Board Inspector** sidebar.
*   **Move**: When a component is selected, a movement gizmo will appear. Drag the handles to reposition pads in real-time.
*   **Save/Load**: Use the **Export** and **Import** buttons to save your board layout as a JSON file and bring it back later.

---

###  A Note for Developers
QuantumPCB was built to show that the web is a first-class platform for high-end engineering software. It’s a mix of **old-school graphics optimization** and **modern React state management**. We hope it inspires you to build something performant!

## 🛠️ Debugging & Diagnostics
To help monitor performance during development, the `Renderer` class includes a `logStatus()` method. You can call this from the browser console to see:
*   **Geometries/Textures**: Quick check for memory bloat.
*   **Draw Calls**: See how well instancing is working.

---


---
*License: MIT | Built for the next generation of EDA tools.*

