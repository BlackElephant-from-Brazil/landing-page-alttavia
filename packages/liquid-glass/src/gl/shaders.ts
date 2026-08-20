export const VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Displacement map generator.
 *
 * Renders to a WxH canvas. For each pixel:
 *  - Computes the squircle (power-6 rounded box) SDF from element center.
 *  - Inside the flat glass area: R=128, G=128 (no displacement).
 *  - Inside the bezel ring: lens warp pushes content inward from the edge.
 *  - Outside: R=128, G=128, A=0 (transparent, not used by feDisplacementMap).
 *
 * Uniforms:
 *  u_resolution  vec2  canvas size in px
 *  u_bezelWidth  float bezel width in px
 *  u_power       float squircle exponent (default 6)
 *  u_strength    float displacement strength multiplier (default 1)
 */
export const DISPLACEMENT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec2  u_resolution;
  uniform float u_bezelWidth;
  uniform float u_power;
  uniform float u_strength;

  // Squircle SDF: 0 at center, 1 at the unit-squircle boundary
  float squircleDist(vec2 p, float power) {
    return pow(abs(p.x), power) + pow(abs(p.y), power);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;         // [0,1]
    vec2 p  = uv - vec2(0.5);                         // [-0.5, 0.5] from center

    // Aspect-ratio-corrected coords so the squircle fits the rectangle
    vec2 pAR = vec2(p.x * (u_resolution.x / u_resolution.y), p.y);

    // SDF for the outer glass edge (the full element boundary)
    float halfW = 0.5 * (u_resolution.x / u_resolution.y);
    float halfH = 0.5;
    float boundaryVal = pow(halfW, u_power) + pow(halfH, u_power);

    float d = squircleDist(pAR, u_power) / boundaryVal; // 0=center, 1=edge

    // Bezel occupies the outer fraction of the element
    float innerHalfW = halfW - u_bezelWidth / u_resolution.y;
    float innerHalfH = halfH - u_bezelWidth / u_resolution.y;
    float innerBoundaryVal = pow(max(0.0, innerHalfW), u_power)
                           + pow(max(0.0, innerHalfH), u_power);
    float innerFrac = innerBoundaryVal / boundaryVal;

    // t: 0 at inner bezel boundary -> 1 at outer edge
    float t = clamp((d - innerFrac) / (1.0 - innerFrac), 0.0, 1.0);

    // Smooth lens warp: content is pushed inward proportional to t
    float warp = t * t * (3.0 - 2.0 * t); // smoothstep
    warp = warp * u_strength;

    // Displacement direction: inward (from pixel toward center)
    vec2 disp = -p * warp * 2.0;  // [-1, 1] range
    disp = clamp(disp, -1.0, 1.0);

    // Map to [0, 1] for RGBA: 0.5 = neutral
    vec2 encoded = disp * 0.5 + 0.5;

    // Alpha: 1 inside (including bezel), 0 outside
    float alpha = step(d, 1.0);

    gl_FragColor = vec4(encoded.x, encoded.y, 0.5, alpha);
  }
`;

/**
 * Specular rim-light pass.
 *
 * Renders bright edge highlight concentrated at the upper-left bezel.
 * Blended on top of the refracted image via feBlend mode="screen".
 *
 * Uniforms:
 *  u_resolution  vec2
 *  u_bezelWidth  float
 *  u_power       float
 *  u_lightAngle  float  light direction in radians (default: -pi/3 ~ -60deg)
 *  u_opacity     float  specular intensity (default: 0.4)
 *  u_saturation  float  colour saturation boost (default: 1.0; > 1 = warm glow)
 */
export const SPECULAR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec2  u_resolution;
  uniform float u_bezelWidth;
  uniform float u_power;
  uniform float u_lightAngle;
  uniform float u_opacity;
  uniform float u_saturation;

  float squircleDist(vec2 p, float power) {
    return pow(abs(p.x), power) + pow(abs(p.y), power);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p  = uv - vec2(0.5);
    vec2 pAR = vec2(p.x * (u_resolution.x / u_resolution.y), p.y);

    float halfW = 0.5 * (u_resolution.x / u_resolution.y);
    float halfH = 0.5;
    float boundaryVal = pow(halfW, u_power) + pow(halfH, u_power);
    float d = squircleDist(pAR, u_power) / boundaryVal;

    float innerHalfW = halfW - u_bezelWidth / u_resolution.y;
    float innerHalfH = halfH - u_bezelWidth / u_resolution.y;
    float innerBoundaryVal = pow(max(0.0, innerHalfW), u_power)
                           + pow(max(0.0, innerHalfH), u_power);
    float innerFrac = innerBoundaryVal / boundaryVal;

    float t = clamp((d - innerFrac) / (1.0 - innerFrac), 0.0, 1.0);
    float isBezel = step(innerFrac, d) * step(d, 1.0);

    // Surface normal (simplified: perpendicular to edge, pointing inward)
    vec2 normal = normalize(-p);

    // Light direction from angle
    vec2 lightDir = vec2(cos(u_lightAngle), sin(u_lightAngle));

    // Specular: Blinn-Phong
    float spec = pow(max(0.0, dot(normal, lightDir)), 12.0);
    spec *= isBezel * u_opacity;

    // Rim glow gradient along bezel
    float rim = (1.0 - t) * max(0.0, dot(normal, lightDir)) * 0.3 * isBezel;

    float intensity = spec + rim;

    // Warm tint for saturation > 1
    vec3 colour = mix(vec3(intensity), vec3(intensity * 1.1, intensity * 0.95, intensity * 0.8), u_saturation - 1.0);
    colour = clamp(colour, 0.0, 1.0);

    gl_FragColor = vec4(colour, intensity);
  }
`;
