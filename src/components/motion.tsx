"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "./i18n";

const useIsoLayout =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Segmented control whose yellow pill slides to the active option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const { t, locale } = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useIsoLayout(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>(
        `[data-value="${CSS.escape(value)}"]`,
      );
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
      // Horizontal only: scrollIntoView would also scroll the page vertically
      // on load (mobile pages opened half-way down).
      const box = wrap.current;
      if (el && box && box.scrollWidth > box.clientWidth)
        box.scrollTo({
          left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
          behavior: "smooth",
        });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, locale]);
  return (
    <div className="segmented" role="group" aria-label={t(label)} ref={wrap}>
      {pill && (
        <span
          className="segmented-pill"
          aria-hidden
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}
      {options.map((o) => (
        <button
          key={o}
          type="button"
          data-value={o}
          className={o === value ? "active" : ""}
          aria-pressed={o === value}
          onClick={() => onChange(o)}
        >
          {t(o)}
        </button>
      ))}
    </div>
  );
}

/** Words rise one after the other. Re-animates when the text changes. */
export function RiseText({
  text: raw,
  as: Tag = "h1",
}: {
  text: string;
  as?: "h1" | "h2" | "p";
}) {
  const { t } = useT();
  const text = t(raw);
  return (
    <Tag className="rise" key={text} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span
          className="rise-word"
          aria-hidden
          key={i}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          {w}&nbsp;
        </span>
      ))}
    </Tag>
  );
}

/** Fades and lifts children into view when they enter the viewport. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return setShown(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal${shown ? " in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
