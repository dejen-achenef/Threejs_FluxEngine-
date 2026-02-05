import * as THREE from 'three';

/**
 * The CopperShader is responsible for that signature technical look of a PCB.
 * It procedurally generates a metallic copper texture and can even 
 * simulate the green solder mask tint over it.
 */
export class CopperShader {
  public static createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uHovered: { value: false },
        uSelected: { value: false },
        uSelectedIntensity: { value: 1.0 },
        uBaseColor: { value: new THREE.Color(0x724520) } // Standard copper base
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      transparent: false,
      depthTest: true,
      depthWrite: true
    });
  }

  // Handles the 3D projection of the copper planes
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

  // Handles the pixel-by-pixel look (colors, lighting, textures)
  private static getFragmentShader(): string {
    return `
      uniform float uTime;
      uniform bool uHovered;
      uniform bool uSelected;
      uniform float uSelectedIntensity;
      uniform vec3 uBaseColor;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;

      // Generates a brushed metal look so the copper doesn't look like flat plastic.
      vec3 generateCopper(vec2 uv, vec3 normal) {
        vec3 copperColor = vec3(0.72, 0.45, 0.20);
        
        // Add those tiny little scratch marks you see on real PCBs
        float brush = sin(uv.x * 50.0) * 0.02 + sin(uv.y * 100.0) * 0.01;
        
        // Random surface "shimmer"
        float roughness = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
        
        vec3 finalColor = copperColor + brush + roughness * 0.05;
        
        // Simulating a bit of natural metallic aging (oxidation)
        float oxidation = fract(sin(dot(uv * 200.0, vec2(93.9898, 28.233))) * 23458.5453);
        finalColor = mix(finalColor, vec3(0.6, 0.3, 0.1), oxidation * 0.1);
        
        return finalColor;
      }

      // Mixes in a dark green tint to simulate the solder mask coating
      vec3 applySolderMask(vec3 baseColor, vec2 uv) {
        vec3 solderMaskColor = vec3(0.0, 0.3, 0.0); // Classic dark green
        
        float variation = fract(sin(dot(uv * 150.0, vec2(45.9898, 67.233))) * 12345.6789);
        return mix(baseColor, solderMaskColor, 0.3 * (0.95 + variation * 0.05));
      }

      // Highlights the corners and edges so they catch the light better
      float edgeFactor() {
        vec3 dx = dFdx(vNormal);
        vec3 dy = dFdy(vNormal);
        float edge = length(dx) + length(dy);
        return smoothstep(0.0, 1.0, edge * 10.0);
      }

      void main() {
        vec3 copperColor = generateCopper(vUv, vNormal);
        vec3 finalColor = applySolderMask(copperColor, vUv);
        
        // Blend in any specific color override the user provided
        finalColor = mix(finalColor, uBaseColor, 0.5);
        
        // Basic lighting to make it feel 3D
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0);
        vec3 diffuse = diff * finalColor;
        
        vec3 ambient = 0.3 * finalColor;
        vec3 color = ambient + diffuse;
        
        float edge = edgeFactor();
        color = mix(color, vec3(1.0), edge * 0.3);
        
        // Pulsing glow when the user hovers over a copper element
        if (uHovered) {
          float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
          color += vec3(0.2, 0.4, 0.8) * pulse * 0.5;
        }
        
        // Solid cyan highlight for the selected element
        if (uSelected) {
          color += vec3(0.3, 0.6, 1.0) * 0.4 * uSelectedIntensity;
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  // Keep the timer ticking so pulse effects stay animated
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

  public static setBaseColor(material: THREE.ShaderMaterial, color: THREE.Color): void {
    if (material.uniforms.uBaseColor) {
      material.uniforms.uBaseColor.value = color;
    }
  }
}
