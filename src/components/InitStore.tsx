"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export function InitStore() {
  const fetchData = useStore(state => state.fetchData);
  const fetchPayments = useStore(state => state.fetchPayments);
  const fetchTaxes = useStore(state => state.fetchTaxes);

  useEffect(() => {
    fetchData();
    fetchPayments();
    fetchTaxes();
  }, [fetchData, fetchPayments, fetchTaxes]);

  return null;
}
