import { redirect } from "next/navigation";

export default function QuoteTemplateSettingsRedirect() {
  redirect("/admin/web/settings/company");
}
