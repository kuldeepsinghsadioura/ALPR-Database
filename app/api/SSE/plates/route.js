// app/api/SSE/plates/route.js
export const runtime = "nodejs";

class PlateEventManager {
  static instance = null;
  subscribers = new Set();

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlateEventManager();
    }
    return this.instance;
  }

  addSubscriber(controller) {
    this.subscribers.add(controller);
    console.log("Client connected. Active subscribers:", this.subscribers.size);
  }

  removeSubscriber(controller) {
    this.subscribers.delete(controller);
    console.log(
      "Client disconnected. Active subscribers:",
      this.subscribers.size
    );
  }

  broadcast(plates) {
    const event = {
      type: "new-plate",
      data: plates,
    };

    this.subscribers.forEach((controller) => {
      try {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error("Failed to send to subscriber:", error);
        this.removeSubscriber(controller);
      }
    });
  }
}

export async function GET() {
  const manager = PlateEventManager.getInstance();

  const stream = new ReadableStream({
    start(controller) {
      manager.addSubscriber(controller);
    },
    cancel(controller) {
      manager.removeSubscriber(controller);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Export the manager for use in other routes
export const plateEvents = PlateEventManager.getInstance();
