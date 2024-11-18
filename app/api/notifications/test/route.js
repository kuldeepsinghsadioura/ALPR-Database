import { sendPushoverNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const plateNumber = formData.get("plateNumber");
    const message = formData.get("message");

    if (!plateNumber) {
      return NextResponse.json(
        { success: false, error: "Plate number is required" },
        { status: 400 }
      );
    }

    const result = await sendPushoverNotification(plateNumber, message);

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
