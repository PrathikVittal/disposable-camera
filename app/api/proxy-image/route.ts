import { NextRequest, NextResponse } from "next/server";

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  if (!CLOUDFRONT_DOMAIN) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const allowedOrigin = `https://${CLOUDFRONT_DOMAIN}`;
  if (!url.startsWith(`${allowedOrigin}/`)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Proxy fetch failed" }, { status: 502 });
  }
}
