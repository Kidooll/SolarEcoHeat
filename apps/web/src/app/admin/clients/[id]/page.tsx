"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { ClientFormPage, type ClientFormInitialData } from "@/components/admin/client-form-page";
import { apiFetch } from "@/lib/api";

function getContactMeta(contacts: any): { email: string; phone: string } {
    if (Array.isArray(contacts) && contacts.length > 0 && contacts[0] && typeof contacts[0] === "object") {
        return {
            email: typeof contacts[0].email === "string" ? contacts[0].email : "",
            phone: typeof contacts[0].phone === "string" ? contacts[0].phone : "",
        };
    }
    if (contacts && typeof contacts === "object") {
        return {
            email: typeof contacts.email === "string" ? contacts.email : "",
            phone: typeof contacts.phone === "string" ? contacts.phone : "",
        };
    }
    return { email: "", phone: "" };
}

function getMaintenanceMeta(raw: any): { frequency: string; days: string[] } {
    if (Array.isArray(raw)) return { frequency: "mensal", days: raw as string[] };
    if (raw && typeof raw === "object") {
        return {
            frequency: typeof raw.frequency === "string" ? raw.frequency : "mensal",
            days: Array.isArray(raw.days) ? raw.days : [],
        };
    }
    return { frequency: "mensal", days: [] };
}

export default function EditClientPage() {
    const params = useParams();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const clientId = params.id as string;
    const isWebContext = pathname.startsWith("/admin/web");
    const returnTo = searchParams.get("returnTo");
    const safeReturnTo = returnTo && returnTo.startsWith("/admin/") ? returnTo : null;
    const backDestination = safeReturnTo || (isWebContext ? "/admin/web/clients" : "/admin/clients");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [initialData, setInitialData] = useState<ClientFormInitialData | undefined>(undefined);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await apiFetch<{
                    success: boolean;
                    data: {
                        client: any;
                        units: any[];
                    };
                }>(`/api/admin/clients/${clientId}`);

                const client = response.data.client;
                const units = response.data.units || [];
                const contact = getContactMeta(client.contacts);
                const firstUnit = units?.[0];
                const maintenance = getMaintenanceMeta(firstUnit?.maintenance_days);

                setInitialData({
                    name: client.name ?? "",
                    document: client.document ?? "",
                    tradeName: client.trade_name ?? "",
                    responsibleName: client.responsible_name ?? "",
                    responsibleRole: client.responsible_role ?? "",
                    email: contact.email,
                    phone: contact.phone,
                    zipCode: client.zip_code ?? "",
                    street: client.street ?? "",
                    number: client.number ?? "",
                    complement: client.complement ?? "",
                    district: client.district ?? "",
                    city: client.city ?? "",
                    stateCode: client.state ?? "AL",
                    country: client.country ?? "Brasil",
                    observations: client.observations ?? "",
                    unitId: firstUnit?.id ?? undefined,
                    unitName: firstUnit?.name ?? "",
                    unitAddress: firstUnit?.address ?? "",
                    maintenanceFrequency: maintenance.frequency,
                    maintenanceDays: maintenance.days,
                });
            } catch {
                setError("Não foi possível carregar o cliente para edição.");
            } finally {
                setLoading(false);
            }
        };

        if (clientId) {
            load();
        }
    }, [clientId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-bg p-4 md:p-8">
                <div className="mx-auto max-w-[980px] h-64 rounded-md border border-border bg-surface animate-pulse" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-bg p-4 md:p-8">
                <div className="mx-auto max-w-[980px] rounded-md border border-crit/40 bg-crit/10 p-4 text-crit text-sm">{error}</div>
            </div>
        );
    }

    return <ClientFormPage mode="edit" clientId={clientId} initialData={initialData} backDestination={backDestination} />;
}
