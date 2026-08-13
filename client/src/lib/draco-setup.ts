import { useGLTF } from '@react-three/drei';

let initialized = false;

export function initDracoDecoder() {
  if (initialized) return true;

  try {
    // drei's useGLTF builds its own module-level DRACOLoader per load and
    // fetches the decoder from the gstatic CDN by default. Point it at the
    // self-hosted decoder so Draco GLBs decode locally (PWA offline, no
    // external dependency). The standalone loader + worker-limit approach
    // can't work: drei's loader is module-private and a custom loader passed
    // via extendLoader is overridden by drei's own inside extensions().
    useGLTF.setDecoderPath('/draco/');
    initialized = true;
    console.log('[Draco] Decoder path set to /draco/');
    return true;
  } catch (error) {
    console.warn('[Draco] Failed to initialize', error);
    return false;
  }
}
