import { verifySession, getSessionInfo } from "@/lib/auth";

export async function POST(req) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ valid: false, message: "Session ID is required" }),
        { status: 400 }
      );
    }

    const isValid = await verifySession(sessionId);
    const sessionInfo = isValid ? await getSessionInfo(sessionId) : null;

    return new Response(
      JSON.stringify({
        valid: isValid,
        sessionInfo: sessionInfo,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in session verification:", error);
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500 }
    );
  }
}
