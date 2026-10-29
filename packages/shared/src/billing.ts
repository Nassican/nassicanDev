export type BillingParty = {
  name: string;
  identification: string;
  address: string;
  city: string;
  email: string;
  phone: string;
};
export type BillingIssuer = BillingParty & {
  bank: string;
  accountType: string;
  accountNumber: string;
  paymentInstructions: string;
};
export type BillingInstallment = {
  id: string;
  label: string;
  amount: string;
  dueDate: string | null;
};
export type BillingPlanDetails = {
  version: 1;
  issuer: BillingIssuer;
  recipient: BillingParty;
  installments: BillingInstallment[];
  paymentTerms: string;
  deliveryTerms: string;
  period: string;
  scopeDescription?: string;
  paymentMode?: "flexible";
  flexiblePayments?: BillingFlexiblePayments;
};
export type BillingFlexibleReceipt = {
  id: string;
  amount: string;
  paidAt: string;
  concept: string;
  reference: string;
  expectedId: string | null;
};
export type BillingExpectedPayment = {
  id: string;
  amount: string | null;
  expectedAt: string | null;
  concept: string;
  receiptId: string | null;
};
export type BillingFlexiblePayments = {
  receipts: BillingFlexibleReceipt[];
  expected: BillingExpectedPayment[];
};
export type ChargeSnapshot = {
  version: 1;
  issuer: BillingIssuer;
  recipient: BillingParty;
  projectTitle: string;
  quoteReference: string;
  concept: string;
  installmentLabel: string;
  installmentNumber: number;
  installmentCount: number;
  amount: string;
  currency: string;
  dueDate: string | null;
  issuedDate: string;
  paymentTerms: string;
  period: string;
};
