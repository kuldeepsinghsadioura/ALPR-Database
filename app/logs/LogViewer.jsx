"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import LogMessage from "./LogMessage";

const LogViewer = ({ initialLogs }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector(
          "[data-radix-scroll-area-viewport]"
        );
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    };

    scrollToBottom();
  }, [initialLogs]);

  if (!initialLogs || !initialLogs.length) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        No logs available
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <ScrollArea
          ref={scrollRef}
          className="w-full rounded-md border h-[85vh]"
        >
          <div className="p-4">
            {initialLogs.map((log, index) => (
              <LogMessage key={index} log={log} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LogViewer;
