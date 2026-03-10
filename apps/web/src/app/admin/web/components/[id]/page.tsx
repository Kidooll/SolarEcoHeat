import { ComponentFormPage } from "@/app/admin/components/new/component-form-page";

export default async function EditComponentWebPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ComponentFormPage accessMode="web" mode="edit" componentId={id} />;
}
