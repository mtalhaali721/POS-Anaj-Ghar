import { Suspense } from "react";
import { CounterScreen } from "@/components/counter-screen";

export default function CounterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-mist">Opening the counter…</p>}>
      <CounterScreen />
    </Suspense>
  );
}
