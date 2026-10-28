import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpEventType } from '@angular/common/http';
import { EMPTY, catchError, combineLatest, switchMap, tap } from 'rxjs';
import { ApiError } from '@core/models/api-response.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { BytesPipe } from '@shared/pipes/format.pipes';
import { OilChangesApi } from '../../data-access/oil-changes.api';

type PlayerState = 'loading' | 'ready' | 'deleted' | 'error';

/**
 * Authenticated video player: downloads the submission's video as a blob
 * (Bearer header) with a progress bar, then plays it from an object URL.
 * The object URL is revoked when the id changes and on destroy.
 */
@Component({
  selector: 'app-oil-video-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, BytesPipe],
  templateUrl: './oil-video-player.component.html',
  styleUrl: './oil-video-player.component.scss',
})
export class OilVideoPlayerComponent {
  private readonly api = inject(OilChangesApi);

  readonly submissionId = input.required<string>();
  /** `videoAvailable` from the submission — false means don't even try. */
  readonly available = input(true);
  readonly expired = input(false);
  /** Fallback total for the progress bar when the response has no Content-Length. */
  readonly sizeBytes = input<number | null | undefined>(null);

  protected readonly state = signal<PlayerState>('loading');
  protected readonly src = signal<string | null>(null);
  protected readonly loaded = signal(0);
  protected readonly total = signal<number | null>(null);
  protected readonly errorMessage = signal('');
  private readonly retry = signal(0);

  protected readonly percent = computed(() => {
    const total = this.total() ?? this.sizeBytes() ?? 0;
    return total > 0 ? Math.min(100, Math.round((this.loaded() / total) * 100)) : null;
  });

  constructor() {
    combineLatest([
      toObservable(this.submissionId),
      toObservable(this.available),
      toObservable(this.retry),
    ])
      .pipe(
        switchMap(([id, available]) => {
          this.release();
          this.loaded.set(0);
          this.total.set(null);
          if (!available) {
            this.state.set('deleted');
            return EMPTY;
          }
          this.state.set('loading');
          return this.api.video(id).pipe(
            tap((event) => {
              if (event.type === HttpEventType.DownloadProgress) {
                this.loaded.set(event.loaded);
                if (event.total) this.total.set(event.total);
              } else if (event.type === HttpEventType.Response && event.body) {
                this.src.set(URL.createObjectURL(event.body));
                this.state.set('ready');
              }
            }),
            catchError((err: ApiError) => {
              if (err.status === 404 || err.status === 410) this.state.set('deleted');
              else {
                this.errorMessage.set(err.message || 'تعذّر تحميل الفيديو');
                this.state.set('error');
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    inject(DestroyRef).onDestroy(() => this.release());
  }

  protected reload(): void {
    this.retry.update((n) => n + 1);
  }

  private release(): void {
    const url = this.src();
    if (url) URL.revokeObjectURL(url);
    this.src.set(null);
  }
}
