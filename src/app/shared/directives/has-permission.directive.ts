import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AuthService } from '@core/auth/services/auth.service';

type PermissionInput = string | ReadonlyArray<string>;

/**
 * Shows or hides the host template as `granted` flips. The view is created
 * `untracked`: components inside it may read and write signals while they are
 * built, and none of that may leak into this effect (it would throw NG0600 on
 * writes, and re-create the whole view whenever a child's signal changed).
 */
function bindTemplate(granted: () => boolean): void {
  const tpl = inject(TemplateRef);
  const vcr = inject(ViewContainerRef);
  let shown: boolean | null = null;

  effect(() => {
    const show = granted();
    if (show === shown) return;
    shown = show;
    untracked(() => {
      vcr.clear();
      if (show) vcr.createEmbeddedView(tpl);
    });
  });
}

/**
 * Renders its host element only when the current user holds the specified
 * permission(s). Array input means "ALL of" — use {@link HasAnyPermissionDirective}
 * for "ANY of" semantics.
 *
 *   <button *appHasPermission="'Treasury.FullAccess'">Transfer</button>
 *   <a *appHasPermission="['Clients.View', 'Suppliers.View']">…</a>
 *
 * Falsy / empty inputs render the element unconditionally — useful when
 * the required permission comes from data (`null` means "no gate").
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  readonly appHasPermission = input.required<PermissionInput | null | undefined>();

  private readonly auth = inject(AuthService);

  constructor() {
    bindTemplate(
      computed(() => {
        const required = this.appHasPermission();
        return required == null || (Array.isArray(required) && required.length === 0)
          ? true
          : this.auth.hasPermission(required as string | readonly string[]);
      }),
    );
  }
}

/**
 * Renders its host element when the current user holds AT LEAST ONE of the
 * specified permissions.
 *
 *   <a *appHasAnyPermission="['Treasury.View', 'Treasury.FullAccess']">Treasury</a>
 */
@Directive({
  selector: '[appHasAnyPermission]',
  standalone: true,
})
export class HasAnyPermissionDirective {
  readonly appHasAnyPermission = input.required<ReadonlyArray<string> | null | undefined>();

  private readonly auth = inject(AuthService);

  constructor() {
    bindTemplate(
      computed(() => {
        const required = this.appHasAnyPermission();
        return !required || required.length === 0 ? true : this.auth.hasAnyPermission(required);
      }),
    );
  }
}
