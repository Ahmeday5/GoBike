import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="error-page">
      <div class="error-code" aria-hidden="true">
        <span>4</span><span class="error-code__wheel"></span><span>4</span>
      </div>
      <h1 class="error-title">الصفحة غير موجودة</h1>
      <p class="error-text">
        يبدو أنك سلكت طريقًا خاطئًا — الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
      </p>
      <a class="btn btn-brand btn-lg" routerLink="/">العودة إلى الرئيسية</a>
    </section>
  `,
  styleUrl: '../../error-page.scss',
})
export class NotFoundComponent {}
