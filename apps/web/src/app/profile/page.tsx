import { redirect } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";

type MeResponse = {
  success: boolean;
  data: {
    role: string;
  };
};

export default async function ProfileRouterPage() {
  const response = await serverApiFetch<MeResponse>("/api/app/me");
  const role = (response.data.role || "").toLowerCase();

  if (role === "admin") {
    redirect("/admin/profile");
  }

  if (role === "technician") {
    redirect("/pwa/profile");
  }

  redirect("/web/profile");
}
