import { createFileRoute } from "@tanstack/react-router";
import { InsaneLab } from "@/components/lab/insane-lab";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <InsaneLab />;
}
