import { Radio } from "lucide-react";

export default function BasicTitle({ title, recording, children }) {
  return (
    <div className="flex min-h-screen flex-col p-5">
      <header className="border-b backdrop-blur">
        <div className="container flex h-14 items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-semibold">
              <span className="flex items-center gap-2">
                {title}
                {recording && <Radio className="text-red-500" />}
              </span>
            </h1>
          </div>
        </div>
      </header>
      <div className="flex-1">
        <div className="py-6">{children}</div>
      </div>
    </div>
  );
}
