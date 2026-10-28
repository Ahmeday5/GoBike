import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MOTORCYCLE_HEALTH, MOTORCYCLE_STATUS } from '@core/constants/enums';
import { FleetMapItem } from '@core/realtime/realtime.models';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { isOffline } from '../../models/fleet-map.models';

type ListTab = 'placed' | 'unplaced';

/**
 * Side list of the live map: every placed bike (click → fly to its marker)
 * and the bikes that can't be placed (no tracker / no fix → open its page).
 * The search is local: the map already holds the whole fleet.
 */
@Component({
  selector: 'app-fleet-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EnumChipComponent, EmptyStateComponent, IconComponent, SearchInputComponent, CairoDatePipe],
  templateUrl: './fleet-list.component.html',
  styleUrl: './fleet-list.component.scss',
})
export class FleetListComponent {
  readonly placed = input.required<readonly FleetMapItem[]>();
  readonly unplaced = input.required<readonly FleetMapItem[]>();
  readonly loading = input(false);
  readonly locate = output<FleetMapItem>();
  readonly open = output<FleetMapItem>();
  readonly closed = output<void>();

  protected readonly STATUS = MOTORCYCLE_STATUS;
  protected readonly HEALTH = MOTORCYCLE_HEALTH;
  protected readonly isOffline = isOffline;

  protected readonly tab = signal<ListTab>('placed');
  protected readonly search = signal('');

  protected readonly rows = computed(() => {
    const list = this.tab() === 'placed' ? this.placed() : this.unplaced();
    const q = this.search().trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      [m.plateNumber, m.internalCode, m.brand, m.model, m.driverName, m.driverPhone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  });

  constructor() {
    // When every bike is unplaced, open on the list that actually has rows.
    effect(() => {
      const empty = this.placed().length === 0 && this.unplaced().length > 0;
      if (empty) untracked(() => this.tab.set('unplaced'));
    });
  }

  protected pick(m: FleetMapItem): void {
    if (this.tab() === 'placed') this.locate.emit(m);
    else this.open.emit(m);
  }
}
