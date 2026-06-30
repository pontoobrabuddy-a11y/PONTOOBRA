"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export function InitStore() {
  const fetchData = useStore(state => state.fetchData);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return null;
}
