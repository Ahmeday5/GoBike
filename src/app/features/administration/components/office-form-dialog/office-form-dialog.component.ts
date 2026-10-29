import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupService } from '@core/data/lookup.service';
import { ApiError } from '@core/models/api-response.model';
import { OfficeDto } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '@shared/components/searchable-select/searchable-select.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { OfficesApi } from '../../data-access/offices.api';
import { SaveOfficeRequest } from '../../models/office.models';

/** Create / edit an office (`POST /offices` · `PUT /offices/{id}`). */
@Component({
  selector: 'app-office-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    SearchableSelectComponent,
    IconComponent,
  ],
  template: `
    <app-modal
      [open]="open()"
      [title]="office() ? 'تعديل بيانات المكتب' : 'إضافة مكتب'"
      size="lg"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <h3 class="form-section-title">البيانات الأساسية</h3>
          <div>
            <label class="form-label" for="o-name">اسم المكتب *</label>
            <input id="o-name" class="form-control" formControlName="name" autocomplete="off" />
            <app-form-error [control]="form.controls.name" label="اسم المكتب" />
          </div>
          <div>
            <label class="form-label" for="o-code">الكود</label>
            <input
              id="o-code"
              class="form-control"
              formControlName="code"
              dir="ltr"
              autocomplete="off"
              placeholder="CAI-01"
            />
            <app-form-error [control]="form.controls.code" label="الكود" />
          </div>
          <div>
            <label class="form-label" for="o-city">المدينة</label>
            <input id="o-city" class="form-control" formControlName="city" />
            <app-form-error [control]="form.controls.city" label="المدينة" />
          </div>
          <div>
            <label class="form-label" for="o-manager">مدير المكتب</label>
            <app-searchable-select
              formControlName="managerUserId"
              [options]="managerOptions()"
              placeholder="بدون مدير"
              searchPlaceholder="ابحث بالاسم أو البريد…"
            />
            <app-form-error [control]="form.controls.managerUserId" label="مدير المكتب" />
          </div>
          <div class="span-2">
            <label class="form-label" for="o-address">العنوان</label>
            <input id="o-address" class="form-control" formControlName="address" />
            <app-form-error [control]="form.controls.address" label="العنوان" />
          </div>

          <h3 class="form-section-title">التواصل</h3>
          <div>
            <label class="form-label" for="o-phone">الهاتف</label>
            <input
              id="o-phone"
              type="tel"
              class="form-control"
              formControlName="phone"
              dir="ltr"
              inputmode="tel"
            />
            <app-form-error [control]="form.controls.phone" label="الهاتف" />
          </div>
          <div>
            <label class="form-label" for="o-email">البريد الإلكتروني</label>
            <input
              id="o-email"
              type="email"
              class="form-control"
              formControlName="email"
              dir="ltr"
            />
            <app-form-error [control]="form.controls.email" label="البريد الإلكتروني" />
          </div>
          <div class="span-2">
            <label class="form-label" for="o-notes">ملاحظات</label>
            <textarea id="o-notes" class="form-control" rows="2" formControlName="notes"></textarea>
          </div>

          <div class="span-2">
            <div class="form-check form-switch">
              <input
                id="o-active"
                class="form-check-input"
                type="checkbox"
                role="switch"
                formControlName="isActive"
              />
              <label class="form-check-label" for="o-active">المكتب نشط</label>
            </div>
            @if (!form.controls.isActive.value) {
              <p class="form-hint">
                <app-icon name="info" [size]="12" />
                المكتب الموقوف لا يظهر في قوائم الاختيار عند إضافة موتوسيكلات أو سائقين جدد.
              </p>
            }
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-brand" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            {{ office() ? 'حفظ التعديلات' : 'إضافة المكتب' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class OfficeFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(OfficesApi);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);

  readonly open = input.required<boolean>();
  readonly office = input<OfficeDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<OfficeDto>();

  private readonly staff = toSignal(this.lookups.staff(), { initialValue: [] });
  protected readonly managerOptions = computed<SearchableSelectOption[]>(() => [
    { value: '', label: 'بدون مدير' },
    ...this.staff().map((u) => ({ value: u.id, label: u.fullName, hint: u.email })),
  ]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    code: ['', Validators.maxLength(30)],
    city: ['', Validators.maxLength(100)],
    address: ['', Validators.maxLength(300)],
    phone: ['', Validators.pattern(/^\+?[\d\s-]{6,20}$/)],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    managerUserId: [''],
    isActive: [true],
    notes: [''],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const o = this.office();
      untracked(() => {
        this.form.reset();
        this.saving.set(false);
        if (o) {
          this.form.patchValue({
            name: o.name,
            code: o.code ?? '',
            city: o.city ?? '',
            address: o.address ?? '',
            phone: o.phone ?? '',
            email: o.email ?? '',
            managerUserId: o.managerUserId ?? '',
            isActive: o.isActive,
            notes: o.notes ?? '',
          });
        }
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: SaveOfficeRequest = {
      name: v.name.trim(),
      code: v.code.trim() || null,
      city: v.city.trim() || null,
      address: v.address.trim() || null,
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      managerUserId: v.managerUserId || null,
      isActive: v.isActive,
      notes: v.notes.trim() || null,
    };
    const editing = this.office();
    this.saving.set(true);
    const request$ = editing ? this.api.update(editing.id, body) : this.api.create(body);
    request$.subscribe({
      next: (o) => {
        this.saving.set(false);
        this.lookups.invalidate();
        this.toast.success(editing ? 'تم حفظ بيانات المكتب' : 'تمت إضافة المكتب');
        this.saved.emit(o);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        // 409 (duplicate name/code) has no field key → its Arabic message is toasted.
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
