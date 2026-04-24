import GradientBlinds from "./GradientBlinds";

export default function GradientBackground() {
  return (
    <div className="ogl-background" aria-hidden="true">
      <GradientBlinds
        gradientColors={["#0c120f", "#050706"]}
        angle={-27}
        noise={0.18}
        blindCount={12}
        blindMinWidth={50}
        spotlightRadius={0.5}
        spotlightSoftness={1}
        spotlightOpacity={1}
        mouseDampening={0.19}
        distortAmount={4.1}
        shineDirection="left"
        mirrorGradient={false}
        mixBlendMode="lighten"
      />
    </div>
  );
}
