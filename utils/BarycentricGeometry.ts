import * as THREE from 'three';

/**
 * Barycentric coordinates are a clever way to tell a shader which 
 * pixel is at an edge of a triangle and which is in the middle.
 * This class injects that data into regular Three.js geometries 
 * so we can draw sharp, pixel-perfect outlines.
 */
export class BarycentricGeometry {

  /**
   * Adds the custom 'barycentric' attribute to any given geometry.
   */
  public static addBarycentricCoordinates(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    // We clone the geometry so we don't accidentally mess up other objects using it
    const geo = geometry.clone();

    const positions = geo.attributes.position;
    if (!positions) {
      console.warn('I can\'t add edges to a geometry that has no positions!');
      return geo;
    }

    const count = positions.count;
    // We need 3 coordinates (x, y, z) per vertex
    const barycentrics = new Float32Array(count * 3);

    // The way we map coordinates depends on if the geometry shared vertices (indexed) or not
    if (geo.index) {
      this.addIndexedBarycentrics(geo, barycentrics);
    } else {
      this.addNonIndexedBarycentrics(geo, barycentrics);
    }

    // Inject the new data into the GPU buffer
    geo.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));

    return geo;
  }

  /**
   * For indexed geometries, we have to map the corners of each triangle 
   * to (1,0,0), (0,1,0), and (0,0,1).
   */
  private static addIndexedBarycentrics(geometry: THREE.BufferGeometry, barycentrics: Float32Array): void {
    const index = geometry.index!;
    const positions = geometry.attributes.position;
    const count = positions.count;

    // Default everyone to (1,0,0) as a starting point
    for (let i = 0; i < count; i++) {
      barycentrics[i * 3] = 1.0;
      barycentrics[i * 3 + 1] = 0.0;
      barycentrics[i * 3 + 2] = 0.0;
    }

    // Loop through every triangle and assign unique "corner" values
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      // Corner A
      barycentrics[a * 3] = 1.0;
      barycentrics[a * 3 + 1] = 0.0;
      barycentrics[a * 3 + 2] = 0.0;

      // Corner B
      barycentrics[b * 3] = 0.0;
      barycentrics[b * 3 + 1] = 1.0;
      barycentrics[b * 3 + 2] = 0.0;

      // Corner C
      barycentrics[c * 3] = 0.0;
      barycentrics[c * 3 + 1] = 0.0;
      barycentrics[c * 3 + 2] = 1.0;
    }
  }

  /**
   * Non-indexed geometry is simpler: every 3 vertices is a triangle.
   */
  private static addNonIndexedBarycentrics(geometry: THREE.BufferGeometry, barycentrics: Float32Array): void {
    const positions = geometry.attributes.position;
    const count = positions.count;

    for (let i = 0; i < count; i += 3) {
      // Vertex A: (1, 0, 0)
      barycentrics[i * 3] = 1.0;
      barycentrics[i * 3 + 1] = 0.0;
      barycentrics[i * 3 + 2] = 0.0;

      // Vertex B: (0, 1, 0)
      barycentrics[(i + 1) * 3] = 0.0;
      barycentrics[(i + 1) * 3 + 1] = 1.0;
      barycentrics[(i + 1) * 3 + 2] = 0.0;

      // Vertex C: (0, 0, 1)
      barycentrics[(i + 2) * 3] = 0.0;
      barycentrics[(i + 2) * 3 + 1] = 0.0;
      barycentrics[(i + 2) * 3 + 2] = 1.0;
    }
  }

  // High-level helpers for common PCB shapes
  public static createBarycentricPlane(width: number, height: number, widthSegments?: number, heightSegments?: number): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
    return this.addBarycentricCoordinates(geometry) as THREE.PlaneGeometry;
  }

  public static createBarycentricCircle(radius: number, segments?: number, thetaStart?: number, thetaLength?: number): THREE.CircleGeometry {
    const geometry = new THREE.CircleGeometry(radius, segments, thetaStart, thetaLength);
    return this.addBarycentricCoordinates(geometry) as THREE.CircleGeometry;
  }

  public static createBarycentricBox(width: number, height: number, depth: number, widthSegments?: number, heightSegments?: number, depthSegments?: number): THREE.BoxGeometry {
    const geometry = new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments);
    return this.addBarycentricCoordinates(geometry) as THREE.BoxGeometry;
  }

  public static createBarycentricCylinder(radiusTop: number, radiusBottom: number, height: number, radialSegments?: number, heightSegments?: number, openEnded?: boolean, thetaStart?: number, thetaLength?: number): THREE.CylinderGeometry {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
    return this.addBarycentricCoordinates(geometry) as THREE.CylinderGeometry;
  }

  /**
   * Sanity check to make sure the data was injected correctly.
   */
  public static validateBarycentrics(geometry: THREE.BufferGeometry): boolean {
    const barycentrics = geometry.attributes.barycentric;
    if (!barycentrics) return false;

    const count = barycentrics.count;
    for (let i = 0; i < count; i++) {
      const x = barycentrics.getX(i);
      const y = barycentrics.getY(i);
      const z = barycentrics.getZ(i);

      // Every vertex MUST have exactly one "1" and two "0"s in its coordinates
      const isValid = (Math.abs(x - 1.0) < 0.001 && Math.abs(y) < 0.001 && Math.abs(z) < 0.001) ||
        (Math.abs(x) < 0.001 && Math.abs(y - 1.0) < 0.001 && Math.abs(z) < 0.001) ||
        (Math.abs(x) < 0.001 && Math.abs(y) < 0.001 && Math.abs(z - 1.0) < 0.001);

      if (!isValid) return false;
    }
    return true;
  }

  public static getBarycentricStats(geometry: THREE.BufferGeometry): {
    hasBarycentrics: boolean;
    vertexCount: number;
    validBarycentrics: boolean;
  } {
    const barycentrics = geometry.attributes.barycentric;
    const hasBarycentrics = barycentrics !== undefined;
    const vertexCount = geometry.attributes.position?.count || 0;
    const validBarycentrics = hasBarycentrics ? this.validateBarycentrics(geometry) : false;

    return {
      hasBarycentrics,
      vertexCount,
      validBarycentrics
    };
  }

  /**
   * Quick check to see if a geometry uses an index buffer.
   */
  public static isIndexed(geometry: THREE.BufferGeometry): boolean {
    return !!geometry.index;
  }
}
