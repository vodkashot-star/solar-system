import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAR, type ARScaleMode } from "@/stores/ar";
import { getHeliocentricPositionAtDays, SIM_SPEED } from "@/lib/astronomy-positions";
import { 
  ENHANCED_ORRERY_CONFIG, 
  getBodiesForScale, 
  type EnhancedOrreryBody 
} from "./enhanced-orrery-data";

// Enhanced sun shader with scale-adaptive effects
const ENHANCED_SUN_SHADER_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ENHANCED_SUN_SHADER_FRAG = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    float n1 = snoise(vPos * 2.5 + vec3(0.0, uTime * 0.08, 0.0));
    float n2 = snoise(vPos * 5.0 + vec3(uTime * 0.12, 0.0, 0.0)) * 0.5;
    float n3 = snoise(vPos * 10.0 + vec3(0.0, 0.0, uTime * 0.15)) * 0.25;
    
    float noise = (n1 + n2 + n3) * 0.5 + 0.5;
    
    float fresnel = dot(vNormal, vec3(0.0, 0.0, 1.0));
    fresnel = pow(1.0 - abs(fresnel), 2.0);
    
    float pulse = 0.9 + 0.1 * sin(uTime * 1.8 + noise * 6.28);
    
    vec3 col = mix(uColorB, uColorA, smoothstep(0.2, 0.8, noise));
    col = mix(col, uColorC, smoothstep(0.6, 1.0, noise));
    
    col *= pulse * uIntensity * (1.0 + fresnel * 0.3);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

function EnhancedSun({ radius, intensity, mode }: { 
  radius: number; 
  intensity: number;
  mode: ARScaleMode;
}) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uColorA: { value: new THREE.Color("#fff4a6") },
      uColorB: { value: new THREE.Color("#ff8c1a") },
      uColorC: { value: new THREE.Color("#ff4444") },
    },
    vertexShader: ENHANCED_SUN_SHADER_VERT,
    fragmentShader: ENHANCED_SUN_SHADER_FRAG,
  }), [intensity]);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });

  const segments = mode === "table" ? 24 : mode === "large" ? 32 : 48;

  return (
    <>
      <mesh material={mat}>
        <sphereGeometry args={[radius, segments, segments]} />
      </mesh>
      <pointLight 
        position={[0, radius * 0.1, 0]} 
        intensity={intensity * 2.5} 
        decay={0} 
        color="#ffd27a" 
      />
    </>
  );
}

function OrbitRing({ radius, visible = true }: { radius: number; visible?: boolean }) {
  const geo = useMemo(() => {
    const segments = Math.max(32, Math.min(128, radius * 200));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  if (!visible) return null;

  return (
    <lineLoop geometry={geo} position={[0, 0.0005, 0]}>
      <lineBasicMaterial color="#8fb8ff" transparent opacity={0.12} />
    </lineLoop>
  );
}

const BODY_TYPE_MATERIALS = {
  planet: new THREE.MeshStandardMaterial({ color: "#4fc3f7", roughness: 0.8, metalness: 0.1 }),
  dwarfPlanet: new THREE.MeshStandardMaterial({ color: "#ffb74d", roughness: 0.85, metalness: 0.05 }),
  asteroid: new THREE.MeshStandardMaterial({ color: "#9e9e9e", roughness: 0.9, metalness: 0.02 }),
  comet: new THREE.MeshStandardMaterial({ color: "#66bb6a", roughness: 0.95, metalness: 0.0 }),
  interstellar: new THREE.MeshStandardMaterial({ color: "#ce93d8", roughness: 0.7, metalness: 0.3 }),
  spacecraft: new THREE.MeshStandardMaterial({ color: "#26c6da", roughness: 0.6, metalness: 0.4 }),
};

const PLANET_GEOMETRY = new THREE.IcosahedronGeometry(1, 2);
const SMALL_BODY_GEOMETRY = new THREE.IcosahedronGeometry(1, 1);
const SPACECRAFT_GEOMETRY = new THREE.BoxGeometry(1, 0.5, 0.7);

export function EnhancedOrrerySystem() {
  const { scale, speed, currentTime, useAstronomicalPositions } = useAR();
  const scaleConfig = ENHANCED_ORRERY_CONFIG.scales[scale];
  const sunConfig = ENHANCED_ORRERY_CONFIG.getSunConfig(scale);
  const showRings = ENHANCED_ORRERY_CONFIG.shouldShowOrbitRings(scale);
  
  const visibleBodies = useMemo(() => getBodiesForScale(scale), [scale]);
  
  const { planetBodies, smallBodies, spacecraftBodies } = useMemo(() => {
    const planets: EnhancedOrreryBody[] = [];
    const small: EnhancedOrreryBody[] = [];
    const spacecraft: EnhancedOrreryBody[] = [];
    
    visibleBodies.forEach(body => {
      if (body.type === "spacecraft") {
        spacecraft.push(body);
      } else if (body.type === "planet") {
        planets.push(body);
      } else {
        small.push(body);
      }
    });
    
    return { 
      planetBodies: planets,
      smallBodies: small, 
      spacecraftBodies: spacecraft 
    };
  }, [visibleBodies]);
  
  const planetsRef = useRef<THREE.InstancedMesh>(null);
  const smallBodiesRef = useRef<THREE.InstancedMesh>(null);
  const spacecraftRef = useRef<THREE.InstancedMesh>(null);
  
  useEffect(() => {
    if (planetsRef.current) {
      planetBodies.forEach((body, i) => {
        planetsRef.current!.setColorAt(i, new THREE.Color(body.color));
      });
      planetsRef.current.instanceColor!.needsUpdate = true;
    }
    
    if (smallBodiesRef.current) {
      smallBodies.forEach((body, i) => {
        smallBodiesRef.current!.setColorAt(i, new THREE.Color(body.color));
      });
      smallBodiesRef.current.instanceColor!.needsUpdate = true;
    }
    
    if (spacecraftRef.current) {
      spacecraftBodies.forEach((body, i) => {
        spacecraftRef.current!.setColorAt(i, new THREE.Color(body.color));
      });
      spacecraftRef.current.instanceColor!.needsUpdate = true;
    }
  }, [planetBodies, smallBodies, spacecraftBodies]);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    const days = currentTime + t * SIM_SPEED;
    const tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const s = new THREE.Vector3();

    // Place a body at its simplified circular orbit, or at its real
    // heliocentric position (scaled to the scale-mode orbit radius) when the
    // temporal real-position mode is active and the body has ephemeris data.
    const placeBody = (body: EnhancedOrreryBody, target: THREE.Vector3) => {
      if (useAstronomicalPositions) {
        const real = getHeliocentricPositionAtDays(body.id, days, body.orbitRadius[scale]);
        if (real) {
          target.set(real.x, real.y, real.z);
          return;
        }
      }
      const angle = body.phase + t * body.orbitSpeed;
      const r = body.orbitRadius[scale];
      target.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    };

    if (planetsRef.current) {
      planetBodies.forEach((body, i) => {
        placeBody(body, pos);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t * body.spinSpeed);
        s.setScalar(body.visualRadius[scale]);

        tmp.compose(pos, q, s);
        planetsRef.current!.setMatrixAt(i, tmp);
      });
      planetsRef.current.instanceMatrix.needsUpdate = true;
    }
    
    if (smallBodiesRef.current) {
      smallBodies.forEach((body, i) => {
        placeBody(body, pos);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t * body.spinSpeed);
        s.setScalar(body.visualRadius[scale]);

        tmp.compose(pos, q, s);
        smallBodiesRef.current!.setMatrixAt(i, tmp);
      });
      smallBodiesRef.current.instanceMatrix.needsUpdate = true;
    }
    
    if (spacecraftRef.current) {
      const basePos = new THREE.Vector3();
      spacecraftBodies.forEach((body, i) => {
        if (body.parentBody) {
          const parent = visibleBodies.find(b => b.id === body.parentBody);
          if (parent) {
            placeBody(parent, basePos);

            const craftAngle = body.phase + t * body.orbitSpeed * 3;
            const craftR = parent.visualRadius[scale] * 2;
            basePos.x += Math.cos(craftAngle) * craftR;
            basePos.z += Math.sin(craftAngle) * craftR;
            pos.copy(basePos);
          } else {
            placeBody(body, pos);
          }
        } else {
          placeBody(body, pos);
        }
        
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t * body.spinSpeed);
        s.setScalar(body.visualRadius[scale]);
        
        tmp.compose(pos, q, s);
        spacecraftRef.current!.setMatrixAt(i, tmp);
      });
      spacecraftRef.current.instanceMatrix.needsUpdate = true;
    }
  });
  
  return (
    <group>
      <EnhancedSun 
        radius={sunConfig.radius} 
        intensity={sunConfig.intensity} 
        mode={scale}
      />
      
      {showRings && visibleBodies.map((body) => (
        body.id !== "sun" && (
          <OrbitRing 
            key={`ring-${body.id}`} 
            radius={body.orbitRadius[scale]}
          />
        )
      ))}
      
      {planetBodies.length > 0 && (
        <instancedMesh 
          ref={planetsRef} 
          args={[PLANET_GEOMETRY, BODY_TYPE_MATERIALS.planet, planetBodies.length]}
        />
      )}
      
      {smallBodies.length > 0 && (
        <instancedMesh 
          ref={smallBodiesRef} 
          args={[SMALL_BODY_GEOMETRY, BODY_TYPE_MATERIALS.asteroid, smallBodies.length]}
        />
      )}
      
      {spacecraftBodies.length > 0 && (
        <instancedMesh 
          ref={spacecraftRef} 
          args={[SPACECRAFT_GEOMETRY, BODY_TYPE_MATERIALS.spacecraft, spacecraftBodies.length]}
        />
      )}
    </group>
  );
}