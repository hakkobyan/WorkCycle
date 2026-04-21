import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const BackgroundGradientAnimation = ({
  gradientBackgroundStart = "rgb(108, 0, 162)",
  gradientBackgroundEnd = "rgb(0, 17, 82)",
  firstColor = "18, 113, 255",
  secondColor = "221, 74, 255",
  thirdColor = "100, 220, 255",
  fourthColor = "200, 50, 50",
  fifthColor = "180, 180, 50",
  pointerColor = "140, 100, 255",
  size = "80%",
  blendingValue = "hard-light",
  children,
  className,
  interactive = true,
  containerClassName,
}) => {
  const interactiveRef = useRef(null);
  const curXRef = useRef(0);
  const curYRef = useRef(0);
  const tgXRef = useRef(0);
  const tgYRef = useRef(0);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    document.body.style.setProperty("--gradient-background-start", gradientBackgroundStart);
    document.body.style.setProperty("--gradient-background-end", gradientBackgroundEnd);
    document.body.style.setProperty("--first-color", firstColor);
    document.body.style.setProperty("--second-color", secondColor);
    document.body.style.setProperty("--third-color", thirdColor);
    document.body.style.setProperty("--fourth-color", fourthColor);
    document.body.style.setProperty("--fifth-color", fifthColor);
    document.body.style.setProperty("--pointer-color", pointerColor);
    document.body.style.setProperty("--size", size);
    document.body.style.setProperty("--blending-value", blendingValue);
  }, [
    blendingValue,
    firstColor,
    fifthColor,
    fourthColor,
    gradientBackgroundEnd,
    gradientBackgroundStart,
    pointerColor,
    secondColor,
    size,
    thirdColor,
  ]);

  useEffect(() => {
    if (!interactive) {
      return undefined;
    }

    let animationFrameId;

    function move() {
      if (interactiveRef.current) {
        curXRef.current += (tgXRef.current - curXRef.current) / 18;
        curYRef.current += (tgYRef.current - curYRef.current) / 18;
        interactiveRef.current.style.transform = `translate(${Math.round(curXRef.current)}px, ${Math.round(curYRef.current)}px)`;
      }

      animationFrameId = window.requestAnimationFrame(move);
    }

    animationFrameId = window.requestAnimationFrame(move);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [interactive]);

  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!interactive) {
      return undefined;
    }

    function handlePointerMove(event) {
      tgXRef.current = event.clientX;
      tgYRef.current = event.clientY;
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [interactive]);

  return (
    <div
      className={cn(
        "relative left-0 top-0 h-screen w-screen overflow-hidden bg-[linear-gradient(40deg,var(--gradient-background-start),var(--gradient-background-end))]",
        containerClassName,
      )}
    >
      <svg className="hidden">
        <defs>
          <filter id="blurMe">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              result="goo"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div className={cn("", className)}>{children}</div>
      <div
        className={cn(
          "gradients-container h-full w-full blur-lg",
          isSafari ? "blur-2xl" : "[filter:url(#blurMe)_blur(40px)]",
        )}
      >
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_var(--first-color)_0,_var(--first-color)_50%)_no-repeat] opacity-100",
            "[mix-blend-mode:var(--blending-value)] h-[var(--size)] w-[var(--size)] left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)]",
            "[transform-origin:center_center] animate-first",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--second-color),_0.8)_0,_rgba(var(--second-color),_0)_50%)_no-repeat] opacity-100",
            "[mix-blend-mode:var(--blending-value)] h-[var(--size)] w-[var(--size)] left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)]",
            "[transform-origin:calc(50%-400px)] animate-second",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--third-color),_0.8)_0,_rgba(var(--third-color),_0)_50%)_no-repeat] opacity-100",
            "[mix-blend-mode:var(--blending-value)] h-[var(--size)] w-[var(--size)] left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)]",
            "[transform-origin:calc(50%+400px)] animate-third",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--fourth-color),_0.8)_0,_rgba(var(--fourth-color),_0)_50%)_no-repeat] opacity-70",
            "[mix-blend-mode:var(--blending-value)] h-[var(--size)] w-[var(--size)] left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)]",
            "[transform-origin:calc(50%-200px)] animate-fourth",
          )}
        />
        <div
          className={cn(
            "absolute [background:radial-gradient(circle_at_center,_rgba(var(--fifth-color),_0.8)_0,_rgba(var(--fifth-color),_0)_50%)_no-repeat] opacity-100",
            "[mix-blend-mode:var(--blending-value)] h-[var(--size)] w-[var(--size)] left-[calc(50%-var(--size)/2)] top-[calc(50%-var(--size)/2)]",
            "[transform-origin:calc(50%-800px)_calc(50%+800px)] animate-fifth",
          )}
        />
        {interactive ? (
          <div
            ref={interactiveRef}
            className={cn(
              "absolute -left-1/2 -top-1/2 h-full w-full opacity-70",
              "[background:radial-gradient(circle_at_center,_rgba(var(--pointer-color),_0.8)_0,_rgba(var(--pointer-color),_0)_50%)_no-repeat]",
              "[mix-blend-mode:var(--blending-value)]",
            )}
          />
        ) : null}
      </div>
    </div>
  );
};
