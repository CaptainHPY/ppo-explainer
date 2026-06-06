"use client";

import { useEffect, useState } from "react";

import { MetricPoint, parseMetricCsv } from "@/lib/metrics";

type MetricSeriesState = {
  data: MetricPoint[];
  isLoading: boolean;
  error: string | null;
};

const initialState: MetricSeriesState = {
  data: [],
  isLoading: true,
  error: null,
};

export function useMetricSeries(path: string): MetricSeriesState {
  const [state, setState] = useState<MetricSeriesState>(initialState);

  useEffect(() => {
    let isCancelled = false;

    async function loadSeries() {
      setState(initialState);

      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load ${path}: ${response.status}`);
        }

        const csvText = await response.text();
        const parsed = parseMetricCsv(csvText);

        if (!isCancelled) {
          setState({
            data: parsed,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({
            data: [],
            isLoading: false,
            error: error instanceof Error ? error.message : "Unknown metric loading error",
          });
        }
      }
    }

    void loadSeries();

    return () => {
      isCancelled = true;
    };
  }, [path]);

  return state;
}
