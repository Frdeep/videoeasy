"use client";
import { useEffect, useState } from "react";

/** True under the mobile breakpoint (matches the CSS `max-width: 900px`). */
export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

/** Index of the child closest to the centre of a horizontal/vertical
 * scroll-snap container, updated while the user swipes. */
export function useSnapIndex(
  ref: React.RefObject<HTMLElement | null>,
  axis: "x" | "y" = "x",
  deps: unknown[] = [],
) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const kids = Array.from(el.children) as HTMLElement[];
        const mid =
          axis === "x"
            ? el.scrollLeft + el.clientWidth / 2
            : el.scrollTop + el.clientHeight / 2;
        let best = 0;
        let dist = Infinity;
        kids.forEach((k, i) => {
          const c =
            axis === "x"
              ? k.offsetLeft + k.offsetWidth / 2
              : k.offsetTop + k.offsetHeight / 2;
          if (Math.abs(c - mid) < dist) {
            dist = Math.abs(c - mid);
            best = i;
          }
        });
        setIndex(best);
      });
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, axis, ...deps]);
  return index;
}
