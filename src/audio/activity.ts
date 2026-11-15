const listeners = new Set<() => void>();
export function onOtherAudio(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function signalOtherAudio() {
  listeners.forEach((f) => f());
}
