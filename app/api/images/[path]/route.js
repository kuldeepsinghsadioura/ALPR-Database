import { NextResponse } from "next/server";
import fileStorage from "@/lib/fileStorage";
import path from "path";

export async function GET(request, { params }) {
  try {
    const imagePath = params.path.join("/");
    const imageData = await fileStorage.getImage(imagePath);

    if (!imageData) {
      return new NextResponse(null, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "image/jpeg");
    // No caching - always fetch fresh
    headers.set("Cache-Control", "no-store");

    return new NextResponse(imageData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return new NextResponse(null, { status: 500 });
  }
}
