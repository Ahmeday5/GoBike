import { Pipe, PipeTransform } from '@angular/core';
import { DateFormat, formatCairo } from '@core/utils/cairo-time.util';
import { formatBytes, formatKm, formatMoney, formatNumber } from '@core/utils/format.util';

/**
 * `{{ x.createdAtUtc | cairoDate }}` · `| cairoDate: 'date'` · `| cairoDate: 'relative'`
 * Always Africa/Cairo, whatever the viewer's clock.
 */
@Pipe({ name: 'cairoDate', standalone: true })
export class CairoDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: DateFormat = 'datetime'): string {
    return formatCairo(value, format);
  }
}

/** `{{ amount | money }}` → EGP, 2 decimals. */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatMoney(value);
  }
}

/** `{{ x.kmSinceOilChange | km }}` → "540 كم". */
@Pipe({ name: 'km', standalone: true })
export class KmPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = false): string {
    return formatKm(value, decimals);
  }
}

@Pipe({ name: 'num', standalone: true })
export class NumberPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = false): string {
    return formatNumber(value, decimals);
  }
}

@Pipe({ name: 'bytes', standalone: true })
export class BytesPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatBytes(value);
  }
}

/** All formatting pipes, for one-line `imports`. */
export const FORMAT_PIPES = [CairoDatePipe, MoneyPipe, KmPipe, NumberPipe, BytesPipe] as const;
