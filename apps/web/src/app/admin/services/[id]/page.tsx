"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { ServiceFormPage } from "@/components/admin/service-form-page";

export default function EditServicePage() {
    const params = useParams();
    const pathname = usePathname();
    const isWebContext = pathname.startsWith("/admin/web");
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    const safeReturnTo = returnTo && returnTo.startsWith("/admin/") ? returnTo : null;
    const backDestination = safeReturnTo || (isWebContext ? "/admin/web/services" : "/admin/services");

    return <ServiceFormPage mode="edit" serviceId={params.id as string} backDestination={backDestination} />;
}
