import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Friendly "nothing here" block. Project an action (button/link) as content.
 *
 *   <app-empty-state icon="bike" title="لا توجد موتوسيكلات" text="جرّب تغيير الفلاتر">
 *     <button class="btn btn-brand">إضافة موتوسيكل</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="es">
      <span class="es__icon"><app-icon [name]="icon()" [size]="28" /></span>
      <p class="es__title">{{ title() }}</p>
      @if (text()) {
        <p class="es__text">{{ text() }}</p>
      }
      <div class="es__actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .es {
      display: grid;
      justify-items: center;
      gap: 0.375rem;
      padding: 1.5rem 1rem;
      text-align: center;
      animation: fade-up var(--dur-4) var(--ease-out) both;
    }
    .es__icon {
      width: 3.75rem;
      height: 3.75rem;
      display: grid;
      place-items: center;
      margin-bottom: 0.5rem;
      border-radius: 1.25rem;
      color: var(--primary);
      background: var(--primary-soft);
      animation: float 5s ease-in-out infinite;
    }
    .es__title {
      margin: 0;
      font-size: var(--fs-md);
      font-weight: 700;
      color: var(--txt);
    }
    .es__text {
      margin: 0;
      max-width: 22rem;
      font-size: var(--fs-sm);
      color: var(--txt2);
      white-space: normal;
    }
    .es__actions:not(:empty) {
      margin-top: 0.75rem;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('search');
  readonly title = input.required<string>();
  readonly text = input<string>('');
}
