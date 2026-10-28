import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EnumMeta, Tone, enumMeta } from '@core/constants/enums';
import { IconComponent } from '../icon/icon.component';

/**
 * Status pill: tone color + icon + text — never color alone (accessibility
 * requirement for green/red health).
 *
 *   <app-chip tone="success" icon="check-circle">متاحة</app-chip>
 */
@Component({
  selector: 'app-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="chip" [class]="'chip chip--' + tone()" [class.chip--sm]="small()">
      @if (icon()) {
        <app-icon [name]="icon()!" [size]="small() ? 12 : 14" />
      }
      <span class="chip__text"><ng-content /></span>
    </span>
  `,
})
export class ChipComponent {
  readonly tone = input<Tone>('neutral');
  readonly icon = input<string | undefined>(undefined);
  readonly small = input(false);
}

/**
 * Renders any backend enum value through its metadata in `core/constants/enums.ts`.
 *
 *   <app-enum-chip [map]="MOTORCYCLE_STATUS" [value]="m.status" />
 */
@Component({
  selector: 'app-enum-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent],
  template: `<app-chip [tone]="meta().tone" [icon]="meta().icon" [small]="small()">{{
    meta().label
  }}</app-chip>`,
})
export class EnumChipComponent {
  readonly map = input.required<Readonly<Record<string, EnumMeta>>>();
  readonly value = input<string | null | undefined>();
  readonly small = input(false);

  protected readonly meta = computed(() => enumMeta(this.map(), this.value()));
}
