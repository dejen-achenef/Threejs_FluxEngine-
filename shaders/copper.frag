uniform float uTime;
uniform bool uHovered;
uniform bool uSelected;
uniform vec3 uBaseColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vViewPosition;

// Procedural copper generation with brushed metal effect
vec3 generateCopper(vec2 uv, vec3 normal) {
  // Base copper color
  vec3 copperColor = vec3(0.72, 0.45, 0.20);
  
  // Add brushed metal pattern using noise-like function
  float brush = sin(uv.x * 50.0) * 0.02 + sin(uv.y * 100.0) * 0.01;
  
  // Surface roughness variation
  float roughness = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  
  // Combine effects
  vec3 finalColor = copperColor + brush + roughness * 0.05;
  
  // Add subtle oxidation variation
  float oxidation = fract(sin(dot(uv * 200.0, vec2(93.9898, 28.233))) * 23458.5453);
  finalColor = mix(finalColor, vec3(0.6, 0.3, 0.1), oxidation * 0.1);
  
  return finalColor;
}

// Solder mask green tint overlay
vec3 applySolderMask(vec3 baseColor, vec2 uv) {
  vec3 solderMaskColor = vec3(0.0, 0.3, 0.0); // Dark green
  
  // Create mask pattern (exposed copper areas)
  float mask = 1.0; // Default: fully covered
  
  // Add variation for realistic solder mask
  float variation = fract(sin(dot(uv * 150.0, vec2(45.9898, 67.233))) * 12345.6789);
  mask *= (0.95 + variation * 0.05);
  
  return mix(baseColor, solderMaskColor, 0.3 * mask);
}

// Edge detection for outline rendering
float edgeFactor() {
  vec3 dx = dFdx(vNormal);
  vec3 dy = dFdy(vNormal);
  float edge = length(dx) + length(dy);
  return smoothstep(0.0, 1.0, edge * 10.0);
}

void main() {
  // Generate procedural copper base
  vec3 copperColor = generateCopper(vUv, vNormal);
  
  // Apply solder mask overlay
  vec3 finalColor = applySolderMask(copperColor, vUv);
  
  // Apply base color tint if provided
  finalColor = mix(finalColor, uBaseColor, 0.5);
  
  // Calculate lighting
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  vec3 diffuse = diff * finalColor;
  
  // Ambient lighting
  vec3 ambient = 0.3 * finalColor;
  
  // Combine lighting
  vec3 color = ambient + diffuse;
  
  // Edge highlighting
  float edge = edgeFactor();
  color = mix(color, vec3(1.0), edge * 0.3);
  
  // Hover effect - emissive glow
  if (uHovered) {
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    color += vec3(0.2, 0.4, 0.8) * pulse * 0.5;
  }
  
  // Selection effect - stronger persistent highlight
  if (uSelected) {
    color += vec3(0.3, 0.6, 1.0) * 0.4;
  }
  
  gl_FragColor = vec4(color, 1.0);
}
