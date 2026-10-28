import { DestroyRef, Injectable, NgZone, effect, inject, signal, untracked } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import type { HubConnection } from '@microsoft/signalr';
import { AuthService } from '../auth/services/auth.service';
import { isJwtExpired } from '../auth/utils/jwt.util';
import { AppConfigService } from '../config/app-config.service';
import { LoggerService } from '../services/logger.service';
import {
  AppNotification,
  FleetMapItem,
  HubStatus,
  MotorcycleHealthChanged,
} from './realtime.models';

/** Delays between automatic reconnect attempts, then keep trying every 30 s. */
const RECONNECT_DELAYS_MS = [0, 2_000, 5_000, 10_000, 30_000];
const RESTART_AFTER_CLOSE_MS = 30_000;

/**
 * The dashboard's single SignalR connection (`/hubs/dashboard`).
 *
 *   - starts when a user signs in, stops on sign-out
 *   - re-reads the access token on every (re)connect, refreshing it first if needed
 *   - reconnects automatically; after a reconnect `reconnected$` fires so
 *     screens re-fetch — the hub does NOT replay messages missed while offline
 *
 * Events are re-emitted as observables inside Angular's zone. The client
 * library is lazy-loaded so it stays out of the login bundle.
 */
@Injectable({ providedIn: 'root' })
export class DashboardHubService {
  private readonly auth = inject(AuthService);
  private readonly config = inject(AppConfigService);
  private readonly zone = inject(NgZone);
  private readonly logger = inject(LoggerService);

  readonly status = signal<HubStatus>('disconnected');

  private readonly locations = new Subject<FleetMapItem[]>();
  private readonly health = new Subject<MotorcycleHealthChanged>();
  private readonly notifications = new Subject<AppNotification>();
  private readonly reconnects = new Subject<void>();

  /** Fresh positions for one office, ~every 5 minutes. Merge by `motorcycleId`. */
  readonly locationsUpdated$ = this.locations.asObservable();
  readonly motorcycleHealthChanged$ = this.health.asObservable();
  readonly notification$ = this.notifications.asObservable();
  /** Fired after a reconnect — re-fetch whatever the screen shows. */
  readonly reconnected$ = this.reconnects.asObservable();

  private connection: HubConnection | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      untracked(() => (signedIn ? void this.start() : void this.stop()));
    });
    inject(DestroyRef).onDestroy(() => void this.stop());
  }

  private async start(): Promise<void> {
    if (this.connection) return;
    this.status.set('connecting');

    const signalR = await import('@microsoft/signalr');
    if (!this.auth.isAuthenticated()) {
      this.status.set('disconnected');
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(this.config.hubUrl, { accessTokenFactory: () => this.freshToken() })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) =>
          RECONNECT_DELAYS_MS[ctx.previousRetryCount] ?? RECONNECT_DELAYS_MS.at(-1)!,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    const emit =
      <T>(subject: Subject<T>) =>
      (payload: T) =>
        this.zone.run(() => subject.next(payload));
    connection.on('locationsUpdated', emit(this.locations));
    connection.on('motorcycleHealthChanged', emit(this.health));
    connection.on('notification', emit(this.notifications));

    connection.onreconnecting(() => this.zone.run(() => this.status.set('reconnecting')));
    connection.onreconnected(() =>
      this.zone.run(() => {
        this.status.set('connected');
        this.reconnects.next();
      }),
    );
    connection.onclose(() =>
      this.zone.run(() => {
        this.status.set('disconnected');
        this.connection = null;
        this.scheduleRestart();
      }),
    );

    this.connection = connection;
    try {
      await connection.start();
      this.status.set('connected');
    } catch (err) {
      this.logger.warn('[hub] connection failed, retrying later', err);
      this.connection = null;
      this.status.set('disconnected');
      this.scheduleRestart();
    }
  }

  private async stop(): Promise<void> {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const connection = this.connection;
    this.connection = null;
    this.status.set('disconnected');
    await connection?.stop().catch(() => undefined);
  }

  /** Automatic reconnect gives up eventually; keep retrying while signed in. */
  private scheduleRestart(): void {
    if (this.restartTimer || !this.auth.isAuthenticated()) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.auth.isAuthenticated()) return;
      void this.start().then(() => {
        if (this.status() === 'connected') this.reconnects.next();
      });
    }, RESTART_AFTER_CLOSE_MS);
  }

  /** The hub sends the token as `?access_token=`; never hand it an expired one. */
  private async freshToken(): Promise<string> {
    const token = this.auth.getAccessToken();
    if (token && !isJwtExpired(token, 30_000)) return token;
    try {
      return (await firstValueFrom(this.auth.refreshToken())).accessToken;
    } catch {
      return token ?? '';
    }
  }
}
