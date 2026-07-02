import { describe, it, expect, beforeEach } from "vitest";
import { useCameraFocus } from "@/stores/camera-focus";
import * as THREE from "three";

describe("camera-focus store", () => {
  beforeEach(() => {
    useCameraFocus.setState({ targetBodyId: null, isFocused: false });
  });

  it("starts with no focus", () => {
    const state = useCameraFocus.getState();
    expect(state.targetBodyId).toBeNull();
    expect(state.isFocused).toBe(false);
  });

  it("focus sets target and marks focused", () => {
    const pos = new THREE.Vector3(10, 5, -20);
    useCameraFocus.getState().focus("mars", pos);

    const state = useCameraFocus.getState();
    expect(state.targetBodyId).toBe("mars");
    expect(state.isFocused).toBe(true);
    expect(state.targetPosition.x).toBe(10);
    expect(state.targetPosition.y).toBe(5);
    expect(state.targetPosition.z).toBe(-20);
  });

  it("clear resets focus state", () => {
    const pos = new THREE.Vector3(1, 2, 3);
    useCameraFocus.getState().focus("venus", pos);
    useCameraFocus.getState().clear();

    const state = useCameraFocus.getState();
    expect(state.targetBodyId).toBeNull();
    expect(state.isFocused).toBe(false);
  });

  it("focus clones the position (no mutation)", () => {
    const pos = new THREE.Vector3(1, 2, 3);
    useCameraFocus.getState().focus("earth", pos);
    pos.x = 999;

    const state = useCameraFocus.getState();
    expect(state.targetPosition.x).toBe(1);
  });
});
