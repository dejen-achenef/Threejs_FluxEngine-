import * as THREE from 'three';

/**
 * The BarycentricShader is used specifically for drawing those nice, 
 * clean black outlines around our 3D shapes.
 * It uses the 'barycentric' data we injected into the geometry to 
 * find the exact edges without needing a messy wireframe.
 */
export class BarycentricShader {
  /**
   * Creates the outline material.
   */
  public static createMaterial(options?: {
    edgeColor?: THREE.Color;
    edgeWidth?: number;
    opacity?: number;
  }): THREE.ShaderMaterial {
    const edgeColor = options?.edgeColor || new THREE.Color(0x000000); // Usually black
    const edgeWidth = options?.edgeWidth || 1.0;
    const opacity = options?.opacity || 1.0;

    return new THREE.ShaderMaterial({
      uniforms: {
        uEdgeColor: { value: edgeColor },
        uEdgeWidth: { value: edgeWidth },
        uOpacity: { value: opacity },
        uTime: { value: 0.0 }
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      transparent: opacity < 1.0,
      depthTest: true,
      depthWrite: true
    });
  }

  // The vertex shader passes the custom barycentric data to the fragment shader
  private static getVertexShader(): string {
    return `
      attribute vec3 barycentric;
      varying vec3 vBarycentric;
      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        vBarycentric = barycentric;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  // The fragment shader does the math to determine if a pixel is "on the edge"
  private static getFragmentShader(): string {
    return `
      uniform vec3 uEdgeColor;
      uniform float uEdgeWidth;
      uniform float uOpacity;
      uniform float uTime;

      varying vec3 vBarycentric;
      varying vec3 vPosition;
      varying vec3 vNormal;

      // Finds the edges of the triangle using the smoothstep function.
      float edgeFactor() {
        vec3 bary = vBarycentric;
        vec3 d = fwidth(bary);
        vec3 a3 = smoothstep(vec3(0.0), d * uEdgeWidth, bary);
        return min(min(a3.x, a3.y), a3.z);
      }

      // Animates the edge width slightly to make the technical design feel "alive"
      float getAnimatedEdgeWidth() {
        float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
        return uEdgeWidth * (1.0 + pulse * 0.3);
      }

      void main() {
        float edge = edgeFactor();
        vec3 edgeColor = uEdgeColor;
        
        float animatedWidth = getAnimatedEdgeWidth();
        vec3 d = fwidth(vBarycentric);
        vec3 a3 = smoothstep(vec3(0.0), d * animatedWidth, vBarycentric);
        float animatedEdge = min(min(a3.x, a3.y), a3.z);
        
        // We only color the pixels that are sitting right on the triangle borders
        vec3 finalColor = mix(edgeColor, vec3(0.0), animatedEdge);
        
        // Transparency handling for faint outlines
        float alpha = (1.0 - animatedEdge) * uOpacity;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;
  }

  // Updates the time uniform to keep the pulse animation running
  public static updateMaterial(material: THREE.ShaderMaterial, time: number): void {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = time;
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
    material.transparent = opacity < 1.0;
    material.needsUpdate = true;
  }
}
