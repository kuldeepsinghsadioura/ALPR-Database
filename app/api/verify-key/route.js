import { getAuthConfig } from "@/lib/auth";

export async function POST(request) {
  try {
    const { apiKey } = await request.json();
    const authConfig = await getAuthConfig();

    if (apiKey === authConfig.apiKey) {
      return Response.json({ valid: true });
    }

    return Response.json({ valid: false }, { status: 401 });
  } catch (error) {
    console.error("Error verifying API key:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
