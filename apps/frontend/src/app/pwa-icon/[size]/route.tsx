import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const allowedSizes = new Set([192, 512]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const requestedSize = Number((await params).size);
  if (!allowedSizes.has(requestedSize)) {
    return new Response("Unsupported icon size", { status: 404 });
  }
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const inset = maskable
    ? Math.round(requestedSize * 0.18)
    : Math.round(requestedSize * 0.1);

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(145deg, #0f2742, #2563eb)",
        color: "white",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: inset,
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "rgba(255,255,255,0.14)",
          border: `${Math.max(4, requestedSize / 50)}px solid rgba(255,255,255,0.75)`,
          borderRadius: "28%",
          display: "flex",
          fontSize: requestedSize * 0.34,
          fontWeight: 900,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -requestedSize * 0.04,
          width: "100%",
        }}
      >
        PC
      </div>
    </div>,
    {
      width: requestedSize,
      height: requestedSize,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}
