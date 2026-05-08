export interface DecisionEvent {
  id: number;
  transactionId: string;
  amount: number;
  score: number;
  modelVersion: string;
  action: 'BLOCK' | 'FLAG' | 'STEP_UP' | 'APPROVE';
  latencyMs: number;
  createdAt: string;
}

export interface ActionStats {
  windowMinutes: number;
  totalDecisions: number;
  counts: Record<string, number>;
}

export interface DriftReport {
  max_psi: number;
  per_feature: Record<string, number>;
  samples: number;
  drifted: boolean;
  threshold: number;
}
