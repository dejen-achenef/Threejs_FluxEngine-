import * as THREE from 'three';

/**
 * This is the "brain" of our 3D look.
 * It's a custom shader that tells the GPU how to draw the copper pads and traces.
 * We've added special logic so it knows exactly which technical "instance" you're 
 * hovering over, allowing for تلك smooth per-object highlights.
 */
export class InstancedHoverShader {
  /**
   * Builds the custom material with all our lighting and interaction "uniforms".
   */
  public static createMaterial(options?: {
    baseColor?: THREE.Color;
    edgeColor?: THREE.Color;
    edgeWidth?: number;
  }): THREE.ShaderMaterial {
    const baseColor = options?.baseColor || new THREE.Color(0xb87333); // Real copper tint
    const edgeColor = options?.edgeColor || new THREE.Color(0x000000); // Black outlines
    let edgeWidth = options?.edgeWidth || 1.5;

    // Safety check to ensure we don't have invisible or inverted edges
    if (edgeWidth < 0) edgeWidth = 0;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 }, // For animations like pulsing
        uHovered: { value: false },
        uSelected: { value: false },
        uHoveredInstanceId: { value: -1.0 }, // Which ID is currently under the mouse
        uSelectedInstanceId: { value: -1.0 }, // Which ID is currently clicked
        uBaseColor: { value: baseColor },
        uEdgeColor: { value: edgeColor },
        uEdgeWidth: { value: edgeWidth }
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      transparent: false,
      depthTest: true,
      depthWrite: true
    });
  }

  /**
   * The Vertex Shader runs per-point. 
   * It handles the math for projecting 3D points onto your screen.
   */
  private static getVertexShader(): string {
    return `
      attribute vec3 barycentric;
      varying vec3 vBarycentric;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      varying float vInstanceId; // We pass the instance ID down to the fragment shader

      void main() {
        vBarycentric = barycentric;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vViewPosition = -vPosition;
        vInstanceId = float(gl_InstanceID); // Each copy has its own ID
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  /**
   * The Fragment Shader runs per-pixel.
   * It's where we do the lighting, reflections, and pulse effects.
   */
  private static getFragmentShader(): string {
    return `
      uniform float uTime;
      uniform bool uHovered;
      uniform bool uSelected;
      uniform float uHoveredInstanceId;
      uniform float uSelectedInstanceId;
      uniform vec3 uBaseColor;
      uniform vec3 uEdgeColor;
      uniform float uEdgeWidth;

      varying vec3 vBarycentric;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      varying float vInstanceId;

      // Fresnel makes the edges look catchier and more metallic.
      float fresnel(vec3 normal, vec3 viewDir) {
        return pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 5.0);
      }

      // Procedurally generates a "brushed copper" texture so we don't need heavy images.
      vec3 generateCopper(vec2 uv, vec3 normal) {
        vec3 copperColor = vec3(0.72, 0.45, 0.20);
        float brush = sin(uv.x * 50.0) * 0.02 + sin(uv.y * 100.0) * 0.01;
        float roughness = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 finalColor = copperColor + brush + roughness * 0.05;
        return finalColor;
      }

      // Finds the boundaries of our faces for drawing sharp outlines.
      float edgeFactor() {
        vec3 bary = vBarycentric;
        vec3 d = fwidth(bary);
        vec3 a3 = smoothstep(vec3(0.0), d * uEdgeWidth, bary);
        return 1.0 - min(min(a3.x, a3.y), a3.z);
      }

      // Math to check if this specific pixel belongs to the hovered instance.
      bool isInstanceHovered() {
        return uHovered && (abs(vInstanceId - uHoveredInstanceId) < 0.1);
      }

      bool isInstanceSelected() {
        return uSelected && (abs(vInstanceId - uSelectedInstanceId) < 0.1);
      }

      void main() {
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        
        vec3 copperBase = generateCopper(vPosition.xy, normal);
        vec3 materialColor = mix(copperBase, uBaseColor, 0.3);
        
        // Simulating a light source from above
        vec3 lightDir = normalize(vec3(5.0, 10.0, 7.5));
        float diff = max(dot(normal, lightDir), 0.0);
        
        // Adding that "metallic flash" reflection (specular)
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        
        // Edge glow
        float f = fresnel(normal, viewDir);
        
        vec3 color = (0.2 * materialColor) + (0.8 * diff * materialColor) + (0.4 * spec * vec3(1.0)) + (0.3 * f * vec3(1.0, 0.9, 0.8));
        
        // Draw the outlines
        float edge = edgeFactor();
        color = mix(color, uEdgeColor, edge * 0.8);
        
        // Blue pulsing highlight for hovering
        if (isInstanceHovered()) {
          float pulse = (sin(uTime * 8.0) * 0.5 + 0.5) * 0.3;
          color += vec3(0.0, 0.5, 1.0) * (0.2 + pulse);
        }
        
        // Cyan glow for selection
        if (isInstanceSelected()) {
          float glow = (sin(uTime * 4.0) * 0.2 + 0.8);
          color = mix(color, vec3(0.1, 0.6, 1.0), 0.4 * glow);
          color += vec3(0.0, 0.3, 0.8) * 0.2;
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  // Update logic to keep our animations smooth
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

  public static setHoveredInstanceId(material: THREE.ShaderMaterial, instanceId: number): void {
    if (material.uniforms.uHoveredInstanceId) {
      material.uniforms.uHoveredInstanceId.value = instanceId;
    }
  }

  public static clearHover(material: THREE.ShaderMaterial): void {
    if (material.uniforms.uHovered) {
      material.uniforms.uHovered.value = false;
    }
    if (material.uniforms.uHoveredInstanceId) {
      material.uniforms.uHoveredInstanceId.value = -1;
    }
  }

  public static setSelected(material: THREE.ShaderMaterial, selected: boolean, instanceId: number = -1): void {
    if (material.uniforms.uSelected) {
      material.uniforms.uSelected.value = selected;
    }
    if (material.uniforms.uSelectedInstanceId) {
      material.uniforms.uSelectedInstanceId.value = instanceId;
    }
  }

  public static setBaseColor(material: THREE.ShaderMaterial, color: THREE.Color): void {
    if (material.uniforms.uBaseColor) {
      material.uniforms.uBaseColor.value = color;
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
}
