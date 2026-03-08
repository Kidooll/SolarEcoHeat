import { redirect } from "next/navigation";

export default function WebSyncFallbackPage() {
  redirect("/web/systems");
}
