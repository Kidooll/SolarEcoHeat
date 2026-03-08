"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type CompanySettings = {
  id?: string;
  legalName: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  website: string;
};

type QuoteTemplateSettings = {
  title: string;
  footerText: string;
  primaryColor: string;
  accentColor: string;
  showLogo: boolean;
  showCompanyDocument: boolean;
  showCompanyAddress: boolean;
  showCompanyContacts: boolean;
  showWebsiteInFooter: boolean;
  showClientTradeName: boolean;
  showNotes: boolean;
};

const EMPTY_SETTINGS: CompanySettings = {
  legalName: "",
  tradeName: "",
  document: "",
  email: "",
  phone: "",
  address: "",
  website: "",
};

const EMPTY_TEMPLATE: QuoteTemplateSettings = {
  title: "Orçamento",
  footerText: "",
  primaryColor: "#3cb040",
  accentColor: "#1e2128",
  showLogo: true,
  showCompanyDocument: true,
  showCompanyAddress: true,
  showCompanyContacts: true,
  showWebsiteInFooter: true,
  showClientTradeName: true,
  showNotes: true,
};

function fieldClassName() {
  return "h-10 w-full rounded border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none";
}

function toggleClassName() {
  return "h-4 w-4 rounded border border-border bg-surface-2 text-brand focus:ring-0";
}

export default function CompanySettingsPage() {
  const [form, setForm] = useState<CompanySettings>(EMPTY_SETTINGS);
  const [templateForm, setTemplateForm] = useState<QuoteTemplateSettings>(EMPTY_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [companyResponse, templateResponse] = await Promise.all([
          apiFetch<{ success: boolean; data: CompanySettings | null }>("/api/admin/settings/company"),
          apiFetch<{ success: boolean; data: QuoteTemplateSettings }>("/api/admin/settings/quote-template"),
        ]);

        if (companyResponse?.data) {
          setForm({
            legalName: companyResponse.data.legalName || "",
            tradeName: companyResponse.data.tradeName || "",
            document: companyResponse.data.document || "",
            email: companyResponse.data.email || "",
            phone: companyResponse.data.phone || "",
            address: companyResponse.data.address || "",
            website: companyResponse.data.website || "",
          });
        }

        if (templateResponse?.data) {
          setTemplateForm({
            title: templateResponse.data.title || EMPTY_TEMPLATE.title,
            footerText: templateResponse.data.footerText || "",
            primaryColor: templateResponse.data.primaryColor || EMPTY_TEMPLATE.primaryColor,
            accentColor: templateResponse.data.accentColor || EMPTY_TEMPLATE.accentColor,
            showLogo: !!templateResponse.data.showLogo,
            showCompanyDocument: !!templateResponse.data.showCompanyDocument,
            showCompanyAddress: !!templateResponse.data.showCompanyAddress,
            showCompanyContacts: !!templateResponse.data.showCompanyContacts,
            showWebsiteInFooter: !!templateResponse.data.showWebsiteInFooter,
            showClientTradeName: !!templateResponse.data.showClientTradeName,
            showNotes: !!templateResponse.data.showNotes,
          });
        }
      } catch (err: any) {
        setError(err.message || "Erro ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const setField = (field: keyof CompanySettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setTemplateField = <K extends keyof QuoteTemplateSettings>(field: K, value: QuoteTemplateSettings[K]) => {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    if (!form.legalName.trim()) {
      setError("Razão social é obrigatória.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await Promise.all([
        apiFetch<{ success: boolean; data: CompanySettings }>("/api/admin/settings/company", {
          method: "PUT",
          body: JSON.stringify(form),
        }),
        apiFetch<{ success: boolean; data: QuoteTemplateSettings }>("/api/admin/settings/quote-template", {
          method: "PUT",
          body: JSON.stringify(templateForm),
        }),
      ]);
      setSuccess("Configurações salvas com sucesso.");
    } catch (err: any) {
      setError(err.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const toggles: Array<{ key: keyof QuoteTemplateSettings; label: string }> = [
    { key: "showLogo", label: "Exibir logo" },
    { key: "showCompanyDocument", label: "Exibir documento da empresa" },
    { key: "showCompanyAddress", label: "Exibir endereço da empresa" },
    { key: "showCompanyContacts", label: "Exibir contatos da empresa" },
    { key: "showWebsiteInFooter", label: "Exibir website no rodapé" },
    { key: "showClientTradeName", label: "Exibir nome fantasia do cliente" },
    { key: "showNotes", label: "Exibir observações" },
  ];

  return (
    <div className="min-h-screen bg-bg text-text p-8">
      <div className="mx-auto max-w-[980px] rounded border border-border bg-surface overflow-hidden">
        <header className="border-b border-border bg-surface-2 px-5 py-4">
          <h1 className="text-[15px] font-bold">Configurações da Empresa</h1>
          <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-text-3 mt-1">Dados usados no cabeçalho e impressão dos orçamentos</p>
        </header>

        <div className="p-5 space-y-4">
          {error && <div className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</div>}
          {success && <div className="rounded border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand">{success}</div>}

          {loading ? (
            <div className="h-24 rounded border border-border bg-surface-2 animate-pulse" />
          ) : (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Empresa</h2>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <label className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Razão social *</span>
                    <input value={form.legalName} onChange={(e) => setField("legalName", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">CNPJ/Documento</span>
                    <input value={form.document} onChange={(e) => setField("document", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Nome fantasia</span>
                    <input value={form.tradeName} onChange={(e) => setField("tradeName", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Telefone</span>
                    <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Email</span>
                    <input value={form.email} onChange={(e) => setField("email", e.target.value)} className={fieldClassName()} type="email" />
                  </label>

                  <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Website</span>
                    <input value={form.website} onChange={(e) => setField("website", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Endereço completo</span>
                    <textarea
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      className="min-h-[96px] w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <h2 className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-3">Template do orçamento</h2>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <label className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Título do documento</span>
                    <input value={templateForm.title} onChange={(e) => setTemplateField("title", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Cor principal</span>
                    <input value={templateForm.primaryColor} onChange={(e) => setTemplateField("primaryColor", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Cor de apoio</span>
                    <input value={templateForm.accentColor} onChange={(e) => setTemplateField("accentColor", e.target.value)} className={fieldClassName()} />
                  </label>

                  <label className="col-span-12 flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.07em] text-text-3">Texto adicional do rodapé</span>
                    <textarea
                      value={templateForm.footerText}
                      onChange={(e) => setTemplateField("footerText", e.target.value)}
                      className="min-h-[96px] w-full rounded border border-border bg-surface-2 px-3 py-2 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus-visible:outline-none"
                    />
                  </label>
                </div>

                <div className="rounded border border-border bg-surface-2 p-4">
                  <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.08em] text-text-3">Elementos visuais</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {toggles.map((toggle) => (
                      <label key={toggle.key} className="flex items-center gap-3 rounded border border-border bg-surface px-3 py-3 text-sm text-text">
                        <input
                          type="checkbox"
                          checked={Boolean(templateForm[toggle.key])}
                          onChange={(e) => setTemplateField(toggle.key, e.target.checked as never)}
                          className={toggleClassName()}
                        />
                        <span>{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="border-t border-border bg-surface-2 px-5 py-4 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="h-10 px-5 rounded border border-brand bg-brand text-black text-sm font-bold disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </footer>
      </div>
    </div>
  );
}
