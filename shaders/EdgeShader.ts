import * as THREE from 'three';

/**
 * The EdgeShader provides a secondary way to render outlines, 
 * focusing specifically on pad boundaries. 
 * It's designed to be clean and reactive to user hover and selection events.
 */
export class EdgeShader {
  /**
   * Builds the shader material with default black edges.
   */
  public static createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uHovered: { value: false },
        uSelected: { value: false },
        uEdgeColor: { value: new THREE.Color(0x000000) },
        uEdgeWidth: { value: 1.0 },
        uOpacity: { value: 1.0 }
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: true,
      // We don't write to the depth buffer so the outlines don't block 
      // other objects that might be sitting right on top of them.
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
  }

  // Standard vertex projection
  private static getVertexShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vViewPosition = -vPosition;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  // Uses UV coordinates to find the edges of the quad geometry
  private static getFragmentShader(): string {
    return `
      uniform float uTime;
      uniform bool uHovered;
      uniform bool uSelected;
      uniform vec3 uEdgeColor;
      uniform float uEdgeWidth;
      uniform float uOpacity;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;

      // Logic to find how close a pixel is to the side of the mesh
      float edgeFactor() {
        vec2 edge = vec2(
          min(vUv.x, 1.0 - vUv.x),
          min(vUv.y, 1.0 - vUv.y)
        );
        return min(edge.x, edge.y);
      }

      float smoothEdge(float edge, float width) {
        return smoothstep(0.0, width, edge);
      }

      void main() {
        float edge = edgeFactor();
        float smoothEdge = smoothEdge(edge, uEdgeWidth * 0.01);
        
        vec3 edgeColor = uEdgeColor;
        
        // Highlighting for hover—turns a bit blue and pulses
        if (uHovered) {
          float pulse = sin(uTime * 4.0) * 0.3 + 0.7;
          edgeColor = mix(edgeColor, vec3(0.2, 0.6, 1.0), pulse * 0.5);
        }
        
        // Highlighting for selection—turns solid blue
        if (uSelected) {
          edgeColor = mix(edgeColor, vec3(0.0, 0.4, 0.8), 0.8);
        }
        
        // We only color the very outer rim of the mesh
        vec3 finalColor = mix(vec3(0.0), edgeColor, smoothEdge);
        
        gl_FragColor = vec4(finalColor, uOpacity * smoothEdge);
      }
    `;
  }

  public static updateMaterial(material: THREE.ShaderMaterial, time: number): void {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = time;
    }
  }

  public static setHovered(material: THREE.ShaderMaterial, hovered: boolean): void {
    if (material.uniforms.uHovered) {
      material.uniforms.uHovered.value = hovered;
    }
  }

  public static setSelected(material: THREE.ShaderMaterial, selected: boolean): void {
    if (material.uniforms.uSelected) {
      material.uniforms.uSelected.value = selected;
    }
  }

  public static setEdgeColor(material: THREE.ShaderMaterial, color: THREE.Color): void {
    if (material.uniforms.uEdgeColor) {
      material.uniforms.uEdgeColor.value = color;
    }
  }

  public static setEdgeWidth(material: THREE.ShaderMaterial, width: number): void {
    if (material.uniforms.uEdgeWidth) {
      material.uniforms.uEdgeWidth.value = width;
    }
  }

  public static setOpacity(material: THREE.ShaderMaterial, opacity: number): void {
    if (material.uniforms.uOpacity) {
      material.uniforms.uOpacity.value = opacity;
    }
  }
}
