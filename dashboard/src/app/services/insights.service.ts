import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

export interface DriftHistoryPoint {
  ts: number;
  max_psi: number;
  per_feature: Record<string, number>;
}
export interface DriftHistory { threshold: number; points: DriftHistoryPoint[]; }

export interface PerfStats {
  samples: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  avg_ms: number;
  max_ms: number;
}

export interface TimeseriesBucket {
  ts: number;
  BLOCK: number;
  FLAG: number;
  STEP_UP: number;
  APPROVE: number;
}
export interface Timeseries { windowMinutes: number; buckets: TimeseriesBucket[]; }

export interface MapDecision {
  id: number;
  transactionId: string;
  amount: number;
  score: number;
  action: 'BLOCK' | 'FLAG' | 'STEP_UP' | 'APPROVE';
  lat: number;
  lon: number;
  city?: string;
  createdAt: string;
}

export interface CopilotResponse {
  answer: string;
  rows: Array<Record<string, any>>;
  mode: string;
}

@Injectable({ providedIn: 'root' })
export class InsightsService {
  constructor(private http: HttpClient) {}

  driftHistory(): Observable<DriftHistory> {
    return this.http.get<DriftHistory>('/api/insights/drift-history');
  }
  pollDriftHistory(everyMs = 30_000): Observable<DriftHistory> {
    return interval(everyMs).pipe(startWith(0), switchMap(() => this.driftHistory()));
  }

  perf(): Observable<PerfStats> {
    return this.http.get<PerfStats>('/api/insights/perf');
  }
  pollPerf(everyMs = 5_000): Observable<PerfStats> {
    return interval(everyMs).pipe(startWith(0), switchMap(() => this.perf()));
  }

  timeseries(minutes = 60): Observable<Timeseries> {
    return this.http.get<Timeseries>(`/api/insights/timeseries?minutes=${minutes}`);
  }
  pollTimeseries(minutes = 60, everyMs = 8_000): Observable<Timeseries> {
    return interval(everyMs).pipe(startWith(0), switchMap(() => this.timeseries(minutes)));
  }

  mapRecent(limit = 200): Observable<MapDecision[]> {
    return this.http.get<MapDecision[]>(`/api/insights/map/recent?limit=${limit}`);
  }
  pollMapRecent(limit = 200, everyMs = 5_000): Observable<MapDecision[]> {
    return interval(everyMs).pipe(startWith(0), switchMap(() => this.mapRecent(limit)));
  }

  askCopilot(question: string): Observable<CopilotResponse> {
    return this.http.post<CopilotResponse>('/api/copilot/ask', { question });
  }
}
