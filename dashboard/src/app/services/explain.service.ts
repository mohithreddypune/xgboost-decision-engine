import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Explanation {
  transactionId: string;
  score: number;
  modelVersion: string;
  baseValue: number;
  contributions: Array<{ feature: string; value: number; contribution: number }>;
  narrative: string;
}

@Injectable({ providedIn: 'root' })
export class ExplainService {
  constructor(private http: HttpClient) {}

  forDecision(id: number): Observable<Explanation> {
    return this.http.get<Explanation>(`/api/explain/decision/${id}`);
  }
}
