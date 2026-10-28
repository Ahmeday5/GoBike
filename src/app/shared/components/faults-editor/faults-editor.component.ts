import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FAULT_SEVERITY, FaultSeverity, enumOptions } from '@core/constants/enums';
import { FaultDto } from '@core/models/domain.models';
import { IconComponent } from '../icon/icon.component';
import { FormErrorComponent } from '../form-error/form-error.component';

export type FaultFormGroup = FormGroup<{
  description: FormControl<string>;
  severity: FormControl<FaultSeverity>;
  isFixed: FormControl<boolean>;
}>;

export type FaultFormArray = FormArray<FaultFormGroup>;

/** One fault row — prefilled when editing an existing report. */
export function createFaultGroup(fault?: Partial<FaultDto> | null): FaultFormGroup {
  return new FormGroup({
    description: new FormControl(fault?.description ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    severity: new FormControl<FaultSeverity>(fault?.severity ?? 'Minor', { nonNullable: true }),
    isFixed: new FormControl(!!fault?.isFixed, { nonNullable: true }),
  });
}

/** Swagger `MaintenanceFaultDto[]` from the array (trimmed; `isFixed` only when tracked). */
export function faultsPayload(
  array: FaultFormArray,
  withFixed = false,
): { description: string; severity: FaultSeverity; isFixed?: boolean }[] {
  return array.getRawValue().map((f) => ({
    description: f.description.trim(),
    severity: f.severity,
    ...(withFixed ? { isFixed: f.isFixed } : {}),
  }));
}

/** Matches the row's exit animation in the styles below. */
const LEAVE_MS = 220;

/**
 * Editable fault list bound to a parent-owned FormArray (return inspection,
 * technician report). The parent keeps the array — this only adds/removes
 * rows and renders them.
 *
 *   <app-faults-editor [faults]="form.controls.faults" [showFixed]="true" />
 */
@Component({
  selector: 'app-faults-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, FormErrorComponent],
  templateUrl: './faults-editor.component.html',
  styleUrl: './faults-editor.component.scss',
})
export class FaultsEditorComponent {
  readonly faults = input.required<FaultFormArray>();
  /** Adds the "تم الإصلاح" column (technician report). */
  readonly showFixed = input(false);
  readonly emptyHint = input('لم تتم إضافة أعطال بعد.');
  readonly idPrefix = input('fault');

  protected readonly severityOptions = enumOptions(FAULT_SEVERITY);

  /**
   * FormArray mutations aren't signals: bump on every array event so OnPush
   * re-renders when the parent pushes, clears or resets rows.
   */
  private readonly tick = signal(0);
  private readonly leaving = signal<ReadonlySet<FaultFormGroup>>(new Set());

  protected readonly rows = computed(() => {
    this.tick();
    return [...this.faults().controls];
  });

  protected readonly summary = computed(() => {
    this.tick();
    const values = this.faults().getRawValue();
    return {
      total: values.length,
      fixed: values.filter((v) => v.isFixed).length,
      critical: values.filter((v) => v.severity === 'Critical').length,
      major: values.filter((v) => v.severity === 'Major').length,
    };
  });

  protected readonly fixedPercent = computed(() => {
    const s = this.summary();
    return s.total ? Math.round((s.fixed / s.total) * 100) : 0;
  });

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    effect(
      (onCleanup) => {
        const sub = this.faults().events.subscribe(() => this.tick.update((n) => n + 1));
        onCleanup(() => sub.unsubscribe());
      },
      { allowSignalWrites: true },
    );
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  protected isLeaving(row: FaultFormGroup): boolean {
    return this.leaving().has(row);
  }

  protected add(): void {
    this.faults().push(createFaultGroup());
    // Focus the new description once it's rendered.
    const id = `${this.idPrefix()}-desc-${this.faults().length - 1}`;
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  protected remove(row: FaultFormGroup): void {
    if (this.isLeaving(row)) return;
    this.leaving.update((s) => new Set(s).add(row));
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      const index = this.faults().controls.indexOf(row);
      if (index >= 0) this.faults().removeAt(index);
      this.faults().markAsDirty();
      this.leaving.update((s) => {
        const next = new Set(s);
        next.delete(row);
        return next;
      });
    }, LEAVE_MS);
    this.timers.add(timer);
  }
}
