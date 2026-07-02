import { describe, it, expect, beforeEach } from "vitest";
import { useCameraFocus } from "@/stores/camera-focus";

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
    useCameraFocus.getState().focus("mars");

    const state = useCameraFocus.getState();
    expect(state.targetBodyId).toBe("mars");
    expect(state.isFocused).toBe(true);
  });

  it("clear resets focus state", () => {
    useCameraFocus.getState().focus("venus");
    useCameraFocus.getState().clear();

    const state = useCameraFocus.getState();
    expect(state.targetBodyId).toBeNull();
    expect(state.isFocused).toBe(false);
  });

  it("can refocus a different body", () => {
    useCameraFocus.getState().focus("mars");
    useCameraFocus.getState().focus("venus");

    const state = useCameraFocus.getState();
    expect(state.targetBodyId).toBe("venus");
    expect(state.isFocused).toBe(true);
  });
});
