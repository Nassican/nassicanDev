import type { Metadata } from "next";
import SubscriptionsModule from "@/components/SubscriptionsModule";
import { getSubscriptions } from "@/lib/subscriptions";
import {
  changeStatus,
  deleteSubscription,
  payNow,
  quickEditSubscription,
  savePayment,
  saveSubscription,
  togglePaidMonth,
} from "./actions";

export const metadata: Metadata = { title: "Suscripciones" };

export default async function SuscripcionesPage() {
  const summary = await getSubscriptions();

  return (
    <SubscriptionsModule
      summary={summary}
      actions={{
        save: saveSubscription,
        remove: deleteSubscription,
        setStatus: changeStatus,
        pay: payNow,
        toggleMonth: togglePaidMonth,
        savePayment,
        quick: quickEditSubscription,
      }}
    />
  );
}
