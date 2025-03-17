import { TrainingControl } from "./TrainingControl";

export default function TrainingPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Training Data Test</h1>
        </div>
        <TrainingControl />
      </div>
    </div>
  );
}
