import { BackgroundGradientAnimation } from "./background-gradient-animation";

export default function GradientBackground() {
  return (
    <div className="gradient-background" aria-hidden="true">
      <div className="gradient-background-base" />
      <BackgroundGradientAnimation
        containerClassName="gradient-background-animation"
        className="gradient-background-animation-copy"
        gradientBackgroundStart="rgba(5, 8, 49, 0)"
        gradientBackgroundEnd="rgba(11, 16, 90, 0)"
        firstColor="38, 103, 255"
        secondColor="170, 92, 255"
        thirdColor="236, 116, 198"
        fourthColor="78, 44, 214"
        fifthColor="128, 118, 255"
        pointerColor="216, 164, 255"
        size="70%"
        blendingValue="screen"
        interactive={false}
      />
      <div className="gradient-background-orb gradient-background-orb-blue" />
      <div className="gradient-background-orb gradient-background-orb-yellow" />
      <div className="gradient-background-orb gradient-background-orb-pink" />
      <div className="gradient-background-orb gradient-background-orb-lilac" />
      <div className="gradient-background-haze" />
    </div>
  );
}
