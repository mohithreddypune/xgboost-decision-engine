import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ActionStats, DecisionEvent, DriftReport } from '../models/decision';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class DecisionService {
  private readonly feed$ = new Subject<DecisionEvent>();
  private readonly connected$ = new BehaviorSubject<boolean>(false);
  private client?: Client;

  constructor(private http: HttpClient, private toasts: ToastService) {
    this.connect();
  }

  decisionFeed(): Observable<DecisionEvent> {
    return this.feed$.asObservable();
  }

  connectionState(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  recent(): Observable<DecisionEvent[]> {
    return this.http.get<DecisionEvent[]>('/api/decisions');
  }

  stats(minutes = 60): Observable<ActionStats> {
    return this.http.get<ActionStats>(`/api/decisions/stats?minutes=${minutes}`);
  }

  drift(): Observable<DriftReport> {
    return this.http.get<DriftReport>('/api/model/drift');
  }

  pollDrift(): Observable<DriftReport> {
    return interval(15_000).pipe(
      startWith(0),
      switchMap(() => this.drift())
    );
  }

  triggerRetrain(): Observable<unknown> {
    return this.http.post('/api/model/retrain', {});
  }

  private connect(): void {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws/decisions'),
      reconnectDelay: 3000,
      onConnect: () => {
        this.connected$.next(true);
        this.client!.subscribe('/topic/decisions', (msg: IMessage) => {
          try {
            const event: DecisionEvent = JSON.parse(msg.body);
            this.feed$.next(event);
          } catch {
            /* ignore malformed */
          }
        });
        this.client!.subscribe('/topic/alerts', (msg: IMessage) => {
          try {
            const a = JSON.parse(msg.body);
            this.toasts.push({
              severity: a.severity || 'warning',
              title: a.title,
              body: a.body
            });
          } catch {
            /* ignore */
          }
        });
      },
      onDisconnect: () => this.connected$.next(false),
      onWebSocketClose: () => this.connected$.next(false)
    });
    this.client.activate();
  }
}
