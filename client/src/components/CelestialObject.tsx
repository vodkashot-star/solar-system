import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toast } from "sonner";
import { useSolarSystem } from "@/lib/stores/useSolarSystem";
import { useAudio } from "@/lib/stores/useAudio";
import type { PlanetData } from "@/data/planets";
import { planetsData } from "@/data/planets";
import { OrbitalInfo } from "./OrbitalInfo";
import { OrbitLine } from "./OrbitLine";
import PlanetModel from "./3d/PlanetModel";
import { getPlanetModelConfig } from "@/lib/planetModels";

interface CelestialObjectProps {
  data: PlanetData;
}

export function CelestialObject({ data }: CelestialObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const orbitGroupRef = useRef<THREE.Group>(null);
  const inclinationGroupRef = useRef<THREE.Group>(null);
  const axialTiltGroupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const {
    discoverPlanet,
    isPlanetDiscovered,
    canDiscoverPlanet,
    setSelectedPlanet,
    getOrbitalOffset,
    initializeOrbitalOffsets,
  } = useSolarSystem();
  const { playSuccess, playHit } = useAudio();

  const discovered = isPlanetDiscovered(data.name);
  const canDiscover = canDiscoverPlanet(data.name);

  useMemo(() => {
    initializeOrbitalOffsets();
  }, [initializeOrbitalOffsets]);

  const orbitalTilt = data.orbitalInclination || 0;
  const axialTilt = data.axialTilt || 0;
  const isAsteroid = data.type === "asteroid";
  const orbitalOffset = getOrbitalOffset(data.name);

  const modelConfig = getPlanetModelConfig(data.name);
  const modelPath = modelConfig?.modelPath || "";
  const modelScale = modelConfig?.scale || data.size;
  const modelRotationSpeed = modelConfig?.rotationSpeed || data.rotationSpeed;

  useFrame((state) => {
    if (inclinationGroupRef.current) {
      inclinationGroupRef.current.rotation.x = orbitalTilt;
    }

    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = orbitalOffset + data.orbitSpeed * 0.1 * state.clock.elapsedTime;
    }

    if (axialTiltGroupRef.current) {
      axialTiltGroupRef.current.rotation.z = axialTilt;
    }

    if (meshRef.current) {
      const rotationSpeed = hovered && canDiscover ? data.rotationSpeed * 2 : data.rotationSpeed;
      meshRef.current.rotation.y += rotationSpeed;

      if (hovered && !discovered && canDiscover) {
        meshRef.current.scale.setScalar(data.size * 1.3);
      } else {
        meshRef.current.scale.setScalar(data.size);
      }
    }

    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7;
      glowRef.current.scale.setScalar(discovered ? (isAsteroid ? 1.3 : 1.4) * pulse : 1.3 * pulse);
    }
  });

  const handleClick = async () => {
    try {
      if (!discovered && canDiscover) {
        discoverPlanet(data.name);
        playSuccess();

        toast.success(`${data.name} discovered!`, {
          description: `Added to your collection.`,
        });
      } else if (discovered) {
        setSelectedPlanet(data.name);
      } else if (!canDiscover) {
        playHit();
        const objectIndex = planetsData.findIndex(p => p.name === data.name);
        const previousObject = objectIndex > 0 ? planetsData[objectIndex - 1] : null;
        if (previousObject) {
          toast.error(`Discover ${previousObject.name} first!`, {
            description: `Must unlock sequentially`,
          });
        }
      }
    } catch (error) {
      console.error("Error handling planet click:", error);
      toast.error("Click failed", {
        description: "An error occurred while processing your click",
      });
    }
  };

  const orbitPoints = [];
  const segments = 128;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    orbitPoints.push(
      new THREE.Vector3(
        Math.cos(angle) * data.orbitRadius,
        0,
        Math.sin(angle) * data.orbitRadius
      )
    );
  }

  const getEmissiveIntensity = () => {
    if (!canDiscover) return 0;
    if (discovered) return 0.4;
    return 0.7;
  };

  const getPlanetColor = () => {
    if (!canDiscover) return "#1a1a1a";
    return data.color;
  };

  const getRingColor = () => {
    const ringColors: Record<string, string> = {
      "Mercury": "#FFD700",
      "Venus": "#FFD700",
      "Earth": "#00D9FF",
      "Mars": "#FF8C00",
      "Jupiter": "#FFD700",
      "Saturn": "#FFD700",
      "Uranus": "#00D9FF",
      "Neptune": "#0099FF"
    };
    return ringColors[data.name] || data.color;
  };

  const shouldHaveRing = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].includes(data.name);
  const isAsteroidLike = data.type === "asteroid" || data.type === "dwarfPlanet";

  return (
    <group ref={inclinationGroupRef}>
      <OrbitLine
        radius={data.orbitRadius}
        discovered={discovered}
        isOwned={discovered}
        segments={128}
        color={getRingColor()}
      />

      <group ref={orbitGroupRef}>
        <group ref={axialTiltGroupRef} position={[data.orbitRadius, 0, 0]}>
          {isAsteroid ? (
            <mesh
              ref={meshRef}
              onClick={handleClick}
              onPointerOver={() => canDiscover && setHovered(true)}
              onPointerOut={() => setHovered(false)}
            >
              <boxGeometry args={[1, 0.8, 0.6]} />
              <meshStandardMaterial
                color={getPlanetColor()}
                emissive={discovered ? getRingColor() : "#000000"}
                emissiveIntensity={discovered ? 0.3 : 0}
                metalness={0.6}
                roughness={0.7}
                toneMapped={true}
              />
            </mesh>
          ) : (
            <group
              onClick={handleClick}
              onPointerOver={() => canDiscover && setHovered(true)}
              onPointerOut={() => setHovered(false)}
            >
              <PlanetModel
                name={data.name}
                modelPath={modelPath}
                scale={modelScale}
                rotationSpeed={modelRotationSpeed}
                position={[0, 0, 0]}
                color={data.color}
              />
            </group>
          )}

          {!isAsteroid && (
            <mesh>
              <torusGeometry args={[data.size * 1.4, data.size * 0.15, 16, 100]} />
              <meshBasicMaterial
                color={getRingColor()}
                transparent
                opacity={canDiscover ? 0.6 : 0.2}
                wireframe={false}
              />
            </mesh>
          )}

          {discovered && !isAsteroid && (
            <mesh ref={glowRef}>
              <sphereGeometry args={[data.size * 1.3, 32, 32]} />
              <meshBasicMaterial
                color={getRingColor()}
                transparent
                opacity={0.25}
                side={THREE.BackSide}
              />
            </mesh>
          )}

          {discovered && isAsteroid && (
            <mesh ref={glowRef}>
              <boxGeometry args={[1.2, 1.0, 0.8]} />
              <meshBasicMaterial
                color={getRingColor()}
                transparent
                opacity={0.3}
                side={THREE.BackSide}
              />
            </mesh>
          )}
        </group>
      </group>

      <OrbitalInfo data={data} hovered={hovered} />
    </group>
  );
}
