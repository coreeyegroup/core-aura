import { renderWav } from "./render-wav.js";
self.onmessage = ({ data }) => {
  try {
    const iterator = renderWav(data.channels, data.master, data.seconds, 44100, data.sequenceGap);
    let last = -1;
    while (true) {
      const next = iterator.next();
      if (next.done) {
        self.postMessage({ buffer: next.value }, [next.value]);
        break;
      }
      if (next.value !== last) {
        last = next.value;
        self.postMessage({ progress: last });
      }
    }
  } catch {
    self.postMessage({ error: "Render failed" });
  }
};
