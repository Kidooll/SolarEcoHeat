"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ClientFormPage } from "@/components/admin/client-form-page";

export default function NewClientPage() {
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    const safeReturnTo = returnTo && returnTo.startsWith("/admin/") ? returnTo : null;
    const backDestination = safeReturnTo || (isWebContext ? "/admin/web/clients" : "/admin/clients");

    return <ClientFormPage mode="create" backDestination={backDestination} />;
}
