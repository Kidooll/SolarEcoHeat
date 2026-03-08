import { ComponentFormPage } from "@/app/admin/components/new/component-form-page";

export default function EditComponentWebPage({ params }: { params: { id: string } }) {
    return <ComponentFormPage accessMode="web" mode="edit" componentId={params.id} />;
}
