// app/api/health-check/route.js
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = await getPool();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return Response.json({ status: "ok" });
  } catch (error) {
    return Response.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
