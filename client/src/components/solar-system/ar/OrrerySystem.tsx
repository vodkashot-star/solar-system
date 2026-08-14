import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAR } from "@/stores/ar";
import { ORRERY_PLANETS, ORRERY_SUN_RADIUS, ORRERY_SCALE } from "../orrery-data";

const SUN_SHADER_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SUN_SHADER_FRAG = /* glsl */ `
  varying vec3 vPos;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

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
    float n = snoise(vPos * 3.0 + vec3(0.0, uTime * 0.12, 0.0));
    n = n * 0.5 + 0.5;
    float pulse = 0.92 + 0.08 * sin(uTime * 2.2);
    vec3 col = mix(uColorB, uColorA, n) * pulse;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sun({ radius, k }: { radius: number; k: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color("#ffe9a8") },
      uColorB: { value: new THREE.Color("#ff7a1a") },
    },
    vertexShader: SUN_SHADER_VERT,
    fragmentShader: SUN_SHADER_FRAG,
  }), []);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <>
      <mesh material={mat}>
        <sphereGeometry args={[radius, 48, 48]} />
      </mesh>
      <pointLight position={[0, 0.03, 0]} intensity={2.2 * k} decay={0} color="#ffd27a" />
    </>
  );
}

function OrbitRing({ radius }: { radius: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <lineLoop geometry={geo} position={[0, 0.0005, 0]}>
      <lineBasicMaterial color="#8fb8ff" transparent opacity={0.16} />
    </lineLoop>
  );
}

const PLANET_GEO = new THREE.IcosahedronGeometry(1, 2);
const MOON_GEO = new THREE.IcosahedronGeometry(1, 1);

export function OrrerySystem() {
  const scale = useAR((s) => s.scale);
  const speed = useAR((s) => s.speed);
  const k = ORRERY_SCALE[scale];

  const planetsRef = useRef<THREE.InstancedMesh>(null);
  const moonsRef = useRef<THREE.InstancedMesh>(null);
  const saturnRingRef = useRef<THREE.Group>(null);

  const { planetCount, moonCount, moonOffsets, saturnIndex } = useMemo(() => {
    let offset = 0;
    const offsets: Record<string, number> = {};
    for (const p of ORRERY_PLANETS) {
      offsets[p.id] = offset;
      offset += p.moons.length;
    }
    return {
      planetCount: ORRERY_PLANETS.length,
      moonCount: offset,
      moonOffsets: offsets,
      saturnIndex: ORRERY_PLANETS.findIndex((p) => p.id === "saturn"),
    };
  }, []);

  useEffect(() => {
    const planets = planetsRef.current;
    if (planets) {
      ORRERY_PLANETS.forEach((p, i) => planets.setColorAt(i, new THREE.Color(p.color)));
      planets.instanceColor!.needsUpdate = true;
    }
    const moons = moonsRef.current;
    if (moons) {
      ORRERY_PLANETS.forEach((p) =>
        p.moons.forEach((m, mi) => moons.setColorAt(moonOffsets[p.id] + mi, new THREE.Color(m.color))),
      );
      moons.instanceColor!.needsUpdate = true;
    }
  }, [moonOffsets]);

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    const tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const s = new THREE.Vector3();
    const planets = planetsRef.current;
    const moons = moonsRef.current;

    for (let i = 0; i < ORRERY_PLANETS.length; i++) {
      const p = ORRERY_PLANETS[i];
      const angle = p.phase + t * p.orbitSpeed;
      const r = p.orbitRadius * k;
      pos.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle + t * p.spinSpeed);
      s.setScalar(p.visualRadius * k);
      tmp.compose(pos, q, s);
      planets?.setMatrixAt(i, tmp);

      if (moons) {
        for (let mi = 0; mi < p.moons.length; mi++) {
          const moon = p.moons[mi];
          const ma = t * moon.orbitSpeed;
          const mr = moon.orbitRadius * k;
          pos.set(
            Math.cos(angle) * r + Math.cos(ma) * mr,
            0,
            Math.sin(angle) * r + Math.sin(ma) * mr,
          );
          q.identity();
          s.setScalar(moon.visualRadius * k);
          tmp.compose(pos, q, s);
          moons.setMatrixAt(moonOffsets[p.id] + mi, tmp);
        }
      }
    }
    if (planets) planets.instanceMatrix.needsUpdate = true;
    if (moons) moons.instanceMatrix.needsUpdate = true;

    if (saturnRingRef.current && saturnIndex >= 0) {
      const saturn = ORRERY_PLANETS[saturnIndex];
      const angle = saturn.phase + t * saturn.orbitSpeed;
      const r = saturn.orbitRadius * k;
      saturnRingRef.current.position.set(Math.cos(angle) * r, 0.001, Math.sin(angle) * r);
    }
  });

  return (
    <group>
      <Sun radius={ORRERY_SUN_RADIUS * k} k={k} />
      {ORRERY_PLANETS.map((p) => (
        <OrbitRing key={`ring-${p.id}`} radius={p.orbitRadius * k} />
      ))}

      <instancedMesh ref={planetsRef} args={[PLANET_GEO, undefined, planetCount]}>
        <meshStandardMaterial roughness={0.82} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={moonsRef} args={[MOON_GEO, undefined, moonCount]}>
        <meshStandardMaterial roughness={0.9} metalness={0.02} />
      </instancedMesh>

      {saturnIndex >= 0 && (
        <group ref={saturnRingRef} rotation={[0, 0, 0.47]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[ORRERY_PLANETS[saturnIndex].visualRadius * k * 1.35, ORRERY_PLANETS[saturnIndex].visualRadius * k * 2.35, 48]} />
            <meshBasicMaterial color="#e3d5ae" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}