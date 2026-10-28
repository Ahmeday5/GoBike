import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Decorative login-hero animation: a motorcycle riding toward the
 * inline-start (left in RTL). Nothing actually travels — the bike stays put
 * while the world moves past it:
 *
 *   - wheels spin backwards (counter-clockwise ⇒ rolling left)
 *   - road dashes, speed streaks and exhaust smoke drift right (behind it)
 *   - the body bobs on its suspension while the wheels stay on the road
 *   - on load the bike drives in from the right and settles
 *
 * Pure SVG + CSS keyframes, no JS timers. A standalone, commented copy of
 * this scene lives in `docs/motorcycle-animation.html`.
 */
@Component({
  selector: 'app-motorcycle-scene',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motorcycle-scene.component.html',
  styleUrl: './motorcycle-scene.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class MotorcycleSceneComponent {
  /** Front and rear axle centers in the 640×300 viewBox. */
  protected readonly wheels = [
    { id: 'front', cx: 170 },
    { id: 'rear', cx: 455 },
  ] as const;

  /** Five cast-alloy spokes, 72° apart. */
  protected readonly spokes = [0, 72, 144, 216, 288] as const;

  /** Speed streaks behind the bike: vertical position, length and start delay. */
  protected readonly streaks = [
    { y: 70, len: 90, delay: 0 },
    { y: 112, len: 60, delay: 0.35 },
    { y: 150, len: 110, delay: 0.7 },
    { y: 186, len: 70, delay: 0.2 },
    { y: 232, len: 80, delay: 0.55 },
  ] as const;

  /** Engine cooling-fin rows (y positions). */
  protected readonly fins = [172, 183, 194, 205] as const;

  /** Exhaust puffs, released one after another. */
  protected readonly puffs = [0, 0.45, 0.9] as const;
}
