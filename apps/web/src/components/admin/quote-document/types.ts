export type QuoteDocumentTemplate = {
  title: string;
  footerText: string | null;
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

export type QuoteDocumentCompany = {
  legalName: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  website: string;
};

export type QuoteDocumentClient = {
  id: string;
  name: string;
  document: string;
  tradeName: string | null;
  contacts: Array<{ email?: string; phone?: string }> | null;
} | null;

export type QuoteDocumentQuote = {
  id: string;
  occurrenceId: string | null;
  clientId: string | null;
  description: string;
  executionScope: "interno" | "externo" | null;
  status: string;
  issueDate: string | null;
  validUntil: string | null;
  subtotal: string;
  discountTotal: string;
  grandTotal: string;
  value: string;
  notes: string | null;
  materialsIncluded: boolean;
  createdAt: string;
};

export type QuoteDocumentItem = {
  id: string;
  description: string;
  quantity: string;
  unitValue: string;
  discount: string;
  lineTotal: string;
  position: number;
};

export type QuoteDocumentPayment = {
  id: string;
  quoteId: string;
  paymentMethod: string;
  installments: number;
  entryAmount: string;
  firstDueDate: string;
  intervalDays: number;
  notes: string | null;
  installmentsList: Array<{
    id: string;
    installmentNumber: number;
    amount: string;
    dueDate: string;
  }>;
} | null;

export type QuoteDocumentData = {
  quote: QuoteDocumentQuote;
  items: QuoteDocumentItem[];
  client: QuoteDocumentClient;
  company: QuoteDocumentCompany;
  template: QuoteDocumentTemplate;
  payment: QuoteDocumentPayment;
  handoff?: {
    urgency: "baixa" | "media" | "alta" | null;
    customerContext: string | null;
    recommendedScope: string | null;
    stage: "none" | "awaiting_admin" | "approved_financial" | "rejected";
    linkedFinanceCount: number;
  } | null;
};
