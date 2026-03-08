import { createClient } from "./supabase/client";

export async function captureAndUploadPhoto(path: string): Promise<string | null> {
    return new Promise((resolve) => {
        // Criar um input temporário de arquivo para disparar a câmera no mobile
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Sugere usar a câmera traseira

        input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }

            try {
                const supabase = createClient();
                const fileName = `${path}/${Date.now()}-${file.name}`;

                const { data, error } = await supabase.storage
                    .from('maintenance-photos')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('maintenance-photos')
                    .getPublicUrl(fileName);

                resolve(publicUrl);
            } catch (err) {
                console.error("Erro no upload da foto:", err);
                resolve(null);
            }
        };

        input.click();
    });
}
