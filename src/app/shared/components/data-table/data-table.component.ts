import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  width?: string;
  align?: 'start' | 'center' | 'end';
  /** Backend `sortBy` value; omit for non-sortable columns. */
  sortKey?: string;
  /** Custom cell. Context: `$implicit` = row. */
  cellTemplate?: TemplateRef<{ $implicit: T }>;
}

export interface SortState {
  sortBy: string;
  sortDesc: boolean;
}

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => i);

/**
 * Generic table. Screens own the data and the sort/page state (in the URL);
 * this component only renders and reports intent.
 *
 *   <app-data-table [columns]="columns()" [data]="rows()" [loading]="res.loading()"
 *     [sortBy]="f.sortBy" [sortDesc]="f.sortDesc" (sortChange)="filters.patch($event)"
 *     [rowClickable]="true" (rowClick)="open($event)" emptyTitle="لا توجد موتوسيكلات" />
 *
 * Loading: skeleton rows on the first load, a dimmed table + progress bar on reloads.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, IconComponent, EmptyStateComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T extends object> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly data = input.required<readonly T[]>();
  readonly loading = input(false);
  readonly trackByKey = input<string>('id');
  readonly rowClickable = input(false);
  readonly sortBy = input<string>('');
  readonly sortDesc = input(false);
  readonly emptyTitle = input('لا توجد بيانات');
  readonly emptyText = input('');
  readonly emptyIcon = input('search');

  readonly rowClick = output<T>();
  readonly sortChange = output<SortState>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly showSkeleton = computed(() => this.loading() && this.data().length === 0);
  protected readonly refreshing = computed(() => this.loading() && this.data().length > 0);

  protected rowKey(row: T, index: number): unknown {
    return (row as Record<string, unknown>)[this.trackByKey()] ?? index;
  }

  protected cellValue(row: T, key: string): string {
    let val: unknown = row;
    for (const k of key.split('.')) {
      val = (val as Record<string, unknown> | null | undefined)?.[k];
    }
    return val == null || val === '' ? '—' : String(val);
  }

  protected toggleSort(col: TableColumn<T>): void {
    if (!col.sortKey) return;
    const same = this.sortBy() === col.sortKey;
    this.sortChange.emit({ sortBy: col.sortKey, sortDesc: same ? !this.sortDesc() : false });
  }

  protected ariaSort(col: TableColumn<T>): string | null {
    if (!col.sortKey) return null;
    if (this.sortBy() !== col.sortKey) return 'none';
    return this.sortDesc() ? 'descending' : 'ascending';
  }

  protected onRowKey(event: KeyboardEvent, row: T): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rowClick.emit(row);
    }
  }
}
