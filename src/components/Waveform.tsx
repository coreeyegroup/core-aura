import { useEffect, useRef } from "react";
import { engine } from "../audio/engine";
export function Waveform() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const samples = new Float32Array(512);
    let frame = 0;
    let last = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function draw(now: number) {
      if (canvas.current && now - last > (reduced ? 1000 : 50)) {
        last = now;
        engine.readWaveform(samples);
        const c = canvas.current,
          pen = c.getContext("2d");
        if (pen) {
          pen.clearRect(0, 0, c.width, c.height);
          pen.beginPath();
          pen.strokeStyle = "#c6d69b";
          pen.lineWidth = 2;
          let peak = 0.015;
          for (const value of samples) peak = Math.max(peak, Math.abs(value));
          for (let i = 0; i < samples.length; i++) {
            const x = (i * c.width) / (samples.length - 1),
              y = c.height / 2 - (samples[i] / peak) * (c.height * 0.38);
            if (i === 0) pen.moveTo(x, y);
            else pen.lineTo(x, y);
          }
          pen.stroke();
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={canvas}
      width="600"
      height="80"
      role="img"
      aria-label="Generated audio waveform"
      className="live-waveform"
    />
  );
}
