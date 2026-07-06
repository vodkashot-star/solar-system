import { useGLTF } from '@react-three/drei';

let initialized = false;

export function initDracoDecoder() {
  if (initialized) return true;

  try {
    useGLTF.setDecoderPath('/draco/');
    initialized = true;
    console.log('[Draco] Decoder path set to /draco/');
    return true;
  } catch (error) {
    console.warn('[Draco] Failed to initialize', error);
    return false;
  }
}
