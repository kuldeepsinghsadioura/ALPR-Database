import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function middleware(request) {
  // Allow public paths
  const publicPaths = [
    "/login",
    "/_next",
    "/favicon.ico",
    "/api/plate-reads", // api auth handled in the route itself
  ];

  if (publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    if (request.nextUrl.pathname === "/api/plates") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const apiKey = authHeader.replace("Bearer ", "");

      try {
        const response = await fetch(
          new URL("/api/auth/verify-key", request.url),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ apiKey }),
          }
        );

        if (!response.ok) {
          return new Response("Invalid API Key", { status: 401 });
        }
      } catch (error) {
        console.error("Auth verification error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    return NextResponse.next();
  }

  // Check session cookie for authenticated routes
  const session = request.cookies.get("session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Verify session
    const response = await fetch(
      new URL("/api/auth/verify-session", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session: session.value }),
      }
    );

    if (!response.ok) {
      // Clear invalid session
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("session");
      return response;
    }
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
