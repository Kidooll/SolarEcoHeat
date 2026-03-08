"use client";

import { useParams } from "next/navigation";
import { ComponentFormPage } from "@/app/admin/components/new/component-form-page";

export default function EditComponentMobilePage() {
    const params = useParams();
    const id = params.id as string;
    return <ComponentFormPage accessMode="mobile" mode="edit" componentId={id} />;
}
