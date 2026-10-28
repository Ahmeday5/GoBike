import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

/**
 * Standard page heading. Project action buttons as content.
 *
 *   <app-page-header title="الموتوسيكلات" subtitle="كل موتوسيكلات الأسطول" backLink="/motorcycles">
 *     <button class="btn btn-brand">…</button>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <header class="ph">
      <div class="ph__text">
        @if (backLink()) {
          <a class="ph__back" [routerLink]="backLink()" aria-label="رجوع">
            <app-icon name="arrow-right" [size]="18" />
          </a>
        }
        <div class="ph__titles">
          <h1 class="ph__title">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="ph__subtitle">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="ph__actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .ph {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      animation: fade-up var(--dur-4) var(--ease-out) both;
    }
    .ph__text {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .ph__back {
      width: 2.5rem;
      height: 2.5rem;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      border: 1px solid var(--brd);
      border-radius: 0.75rem;
      background: var(--bg2);
      color: var(--txt2);
      transition:
        color var(--dur-2),
        background var(--dur-2),
        transform var(--dur-3) var(--ease-spring);
      &:hover {
        color: var(--primary);
        background: var(--primary-soft);
        transform: translateX(3px);
      }
    }
    .ph__titles {
      min-width: 0;
    }
    .ph__title {
      margin: 0;
      font-size: var(--fs-xl);
      font-weight: 700;
    }
    .ph__subtitle {
      margin: 0.25rem 0 0;
      font-size: var(--fs-sm);
      color: var(--txt2);
    }
    .ph__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly backLink = input<string | unknown[] | null>(null);
}
