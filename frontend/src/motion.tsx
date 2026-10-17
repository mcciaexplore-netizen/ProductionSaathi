import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts a numeric stat up from 0 the first time it scrolls into view.
 * Non-numeric values (e.g. "₹1,200" or "—") render unchanged; a trailing
 * suffix such as "%" is preserved.
 */
export function CountUp({ value }: { value: number | string }) {
  const match = String(value).match(/^(-?[\d,]*\.?\d+)(.*)$/s),
    target = match ? Number(match[1].replaceAll(",", "")) : NaN,
    suffix = match ? match[2] : "",
    decimals = match?.[1].split(".")[1]?.length ?? 0,
    animatable = Number.isFinite(target) && !reducedMotion();
  const ref = useRef<HTMLSpanElement>(null),
    done = useRef(false),
    [shown, setShown] = useState(animatable ? 0 : target);

  useEffect(() => {
    if (!animatable) return;
    // After the first run, later data updates show immediately.
    if (done.current) {
      setShown(target);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1800);
          setShown(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) frame = requestAnimationFrame(tick);
          else done.current = true;
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, animatable]);

  if (!Number.isFinite(target)) return <>{value}</>;
  return (
    <span ref={ref}>
      {shown.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * Decorative 45px grid drifting diagonally behind a hero block. Hovered
 * cells fill faintly and leave a fading trail of six cells.
 */
export function GridBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current,
      host = canvas?.parentElement,
      ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    // Colours come from the --grid-stroke / --grid-fill theme tokens.
    const style = getComputedStyle(host),
      stroke = style.getPropertyValue("--grid-stroke").trim(),
      fill = style.getPropertyValue("--grid-fill").trim();
    const size = 45,
      still = reducedMotion(),
      trail: { col: number; row: number; life: number }[] = [];
    let offset = 0,
      frame = 0,
      width = 0,
      height = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const cell of trail) {
        ctx.globalAlpha = cell.life;
        ctx.fillStyle = fill;
        ctx.fillRect(
          cell.col * size + offset,
          cell.row * size + offset,
          size,
          size,
        );
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (offset % size) - size; x < width + size; x += size) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = (offset % size) - size; y < height + size; y += size) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();
    };

    const loop = () => {
      offset += 0.4;
      for (const cell of trail) cell.life -= 0.012;
      while (trail.length && trail[0].life <= 0) trail.shift();
      draw();
      frame = requestAnimationFrame(loop);
    };

    const move = (e: PointerEvent) => {
      const box = host.getBoundingClientRect(),
        col = Math.floor((e.clientX - box.left - offset) / size),
        row = Math.floor((e.clientY - box.top - offset) / size),
        last = trail.at(-1);
      if (last && last.col === col && last.row === row) {
        last.life = 1;
        return;
      }
      trail.push({ col, row, life: 1 });
      if (trail.length > 6) trail.shift();
      if (still) draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener("pointermove", move);
    resize();
    if (!still) frame = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={ref} className="hero-grid" aria-hidden="true" />;
}
