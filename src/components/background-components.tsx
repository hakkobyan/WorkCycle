export function BackgroundComponents() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f8f7fb]">
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 32%, rgba(168, 137, 255, 0.22) 0%, rgba(190, 170, 255, 0.14) 24%, rgba(233, 228, 255, 0.08) 44%, rgba(248, 247, 251, 0) 72%)",
        }}
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(120, 132, 160, 0.24) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(120, 132, 160, 0.24) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          backgroundPosition: "center center",
        }}
      />
    </div>
  );
}

export default BackgroundComponents;
