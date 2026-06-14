// src/app/Adapters/Common/Icons/svg-icons-manager/svg-icons-manager.component.ts
import {
  Component,
  Input,
  HostBinding,
  ChangeDetectionStrategy,
  OnChanges,
} from '@angular/core';
import { Observable } from 'rxjs';
import { SafeHtml } from '@angular/platform-browser';
import { SemanticColor, SizeToken, SvgIconService } from 'src/app/Infrastructure/Services/icons/svg-icon.service';


@Component({
  standalone: false,
  selector: 'app-svg-icon',
  templateUrl: './svg-icons-manager.component.html',
  styleUrls: ['./svg-icons-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvgIconsManagerComponent implements OnChanges {
  // ═══════════════════════════════════════════════════════════════
  // Inputs
  // ═══════════════════════════════════════════════════════════════
  /** Required — SVG filename without extension, e.g. "calendar", "chevrons-left" */
  @Input() name!: string;

  /** Direct CSS color, e.g. '#2B8A9C' or 'red'. Overridden by semanticColor. */
  @Input() color?: string;

  /**
   * Semantic / theme-aware color.
   * Maps to CSS custom properties set by ThemeService:
   *   'primary'   → var(--org-primary-color)
   *   'secondary' → var(--org-secondary-color)
   *   'accent'    → var(--org-accent-color)
   *   'success'   → var(--theme-success)
   *   'warning'   → var(--theme-warning)
   *   'danger'    → var(--theme-error)
   *   'neutral' / 'inherit' → currentColor
   */
  @Input() semanticColor?: SemanticColor;

  /** Size — number (px), CSS string ('1.5rem'), or token ('xs'|'sm'|'md'|'lg'|'xl'|'xxl') */
  @Input() size: number | string | SizeToken = 24;

  /** Override SVG stroke-width */
  @Input() strokeWidth?: number;

  /** Accessibility label. If omitted, icon is decorative (aria-hidden). */
  @Input() ariaLabel?: string;

  /**
   * When true, the icon wrapper gets tabindex="0" and role="button",
   * enabling keyboard navigation and focus styling.
   */
  @Input() interactive = false;

  // ═══════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════
  sizeCss = '24px';
  icon$?: Observable<SafeHtml>;

  /** Host bindings for accessibility — auto-hide decorative icons */
  @HostBinding('attr.aria-hidden')
  get hostAriaHidden(): string | null {
    return this.ariaLabel ? null : 'true';
  }

  @HostBinding('attr.role')
  get hostRole(): string | null {
    if (this.interactive) return 'button';
    return this.ariaLabel ? 'img' : null;
  }

  @HostBinding('attr.tabindex')
  get hostTabIndex(): string | null {
    return this.interactive ? '0' : null;
  }

  @HostBinding('class.svg-icon')
  readonly svgIconClass = true;

  constructor(private icons: SvgIconService) { }

  ngOnChanges(): void {
    if (!this.name) return;

    // Resolve size for the wrapper element
    const resolved = this.icons.resolveSize(this.size);
    this.sizeCss = resolved
      ? (resolved.match(/^\d+$/) ? `${resolved}px` : resolved)
      : '24px';

    // Fetch and transform the SVG inline
    this.icon$ = this.icons.getIconInline(this.name, {
      color: this.color,
      semanticColor: this.semanticColor,
      size: this.size,
      strokeWidth: this.strokeWidth,
    });
  }
}
