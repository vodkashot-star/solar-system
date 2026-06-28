import { useMemo } from "react";
import * as THREE from "three";

type Props = {
  count?: number;
  radius?: number;
  depth?: number;
  factor?: number;
  saturation?: number;
  fade?: boolean;
  speed?: number;
};

const _v = new THREE.Vector3();

function randomInSphere(radius: number, depth: number) {
  const r = radius * (0.5 + Math.random() * 0.5);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  _v.setFromSphericalCoords(r, phi, theta);
  _v.z *= depth / radius;
  return _v.clone();
}

export default function InstancedStars({
  count = 6000,
  radius = 200,
  depth = 80,
  factor = 4,
  saturation = 0,
  fade = true,
}: Props) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const p = randomInSphere(radius, depth);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      color.setHSL(
        0.6 + Math.random() * 0.2,
        saturation,
        0.5 + Math.random() * 0.5,
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = factor * (0.5 + Math.random() * 1.5);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    return geo;
  }, [count, radius, depth, factor, saturation]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={1}
        vertexColors
        transparent
        opacity={fade ? 0.8 : 1}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
