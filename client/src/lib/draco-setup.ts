import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { useGLTF } from '@react-three/drei';

let initialized = false;

export function initDracoDecoder() {
  if (initialized) return true;

  try {
    const loader = new DRACOLoader();
    loader.setDecoderPath('/draco/');
    (useGLTF as unknown as { setDRACOLoader: (loader: DRACOLoader) => void }).setDRACOLoader(loader);
    initialized = true;
    console.log('[Draco] Decoder wired into useGLTF');
    return true;
  } catch (error) {
    console.warn('[Draco] Failed to initialize', error);
    return false;
  }
}
