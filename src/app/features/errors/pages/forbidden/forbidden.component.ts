import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="error-page">
      <div class="error-code" aria-hidden="true">
        <span>4</span><span class="error-code__wheel"></span><span>3</span>
      </div>
      <h1 class="error-title">غير مصرح لك بالوصول</h1>
      <p class="error-text">
        ليست لديك صلاحية لعرض هذه الصفحة. تواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ.
      </p>
      <a class="btn btn-brand btn-lg" routerLink="/">العودة إلى الرئيسية</a>
    </section>
  `,
  styleUrl: '../../error-page.scss',
})
export class ForbiddenComponent {}
