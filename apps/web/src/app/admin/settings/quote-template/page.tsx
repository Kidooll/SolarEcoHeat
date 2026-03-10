import { redirect } from "next/navigation";

export default function AdminQuoteTemplateSettingsRedirect() {
  redirect("/admin/settings/company");
}
