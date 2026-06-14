// src/app/infrastructure/services/icons/svg-icon.service.ts
import { Injectable, Inject, InjectionToken, Optional } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import { BUNDLED_ICONS } from './bundled-icons';

// ═══════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════
export const ICONS_BASE_PATH = new InjectionToken<string>('ICONS_BASE_PATH');

/** Semantic color names — resolved to CSS custom properties at runtime */
export type SemanticColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'inherit';

/** Standard size tokens */
export type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** Options for inline SVG rendering */
export interface SvgIconOptions {
  color?: string;
  semanticColor?: SemanticColor;
  size?: number | string | SizeToken;
  strokeWidth?: number;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════
function toFileName(n: string): string {
  return n.trim().replace(/\.svg$/i, '').replace(/\s+|_/g, '-').toLowerCase();
}

/** True only when the text is real SVG markup — guards against the prod SPA
 *  catch-all returning index.html (HTTP 200) for a missing icon asset. */
function looksLikeSvg(text: string): boolean {
  if (!text) return false;
  const t = text.trimStart().toLowerCase();
  if (t.startsWith('<!doctype') || t.startsWith('<html')) return false;
  return t.includes('<svg');
}

function normalizeBase(tokenBase?: string): string {
  if (tokenBase && tokenBase.trim()) {
    return tokenBase.replace(/\/+$/, '').startsWith('/')
      ? tokenBase.replace(/\/+$/, '')
      : `/${tokenBase.replace(/\/+$/, '')}`;
  }
  // Always use a relative path so assets load from the current origin,
  // not from environment.frontTarget which may point to a different
  // subdomain (e.g. www.weekeye.com vs org.weekeye.com) causing CORS errors.
  return '/assets/icons_svgs';
}

function join(base: string, file: string): string {
  return `${base.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`;
}

// ═══════════════════════════════════════════════════════════════════
// Size + Color maps
// ═══════════════════════════════════════════════════════════════════
const SIZE_MAP: Record<SizeToken, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/** Maps semantic names to CSS custom properties (set by ThemeService) */
const SEMANTIC_COLOR_MAP: Record<SemanticColor, string> = {
  primary: 'var(--org-primary-color)',
  secondary: 'var(--org-secondary-color)',
  accent: 'var(--org-accent-color)',
  success: 'var(--theme-success)',
  warning: 'var(--theme-warning)',
  danger: 'var(--theme-error)',
  neutral: 'currentColor',
  inherit: 'currentColor',
};

@Injectable({ providedIn: 'root' })
export class SvgIconService {
  private basePath: string;
  private httpRaw: HttpClient;
  /** In-memory SVG cache keyed by URL — prevents duplicate HTTP calls */
  private cache = new Map<string, Observable<string>>();
  /** Bundled fallback content keyed by normalized name (e.g. "bell"). Used
   *  only when the disk fetch fails — so newly dropped/updated SVG files on
   *  disk always win and never get shadowed by stale inline content. */
  private bundledByName = new Map<string, string>();

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    handler: HttpBackend,
    @Optional() @Inject(ICONS_BASE_PATH) providedBase?: string
  ) {
    this.basePath = normalizeBase(providedBase);
    this.httpRaw = new HttpClient(handler);

    // Index bundled icons by normalized name. Do NOT pre-seed the URL cache —
    // pre-seeding made the disk file unreachable forever, so new SVGs dropped
    // into /assets/icons_svgs would never render (the cached inline copy
    // always won). Bundled now acts as a fetch-failure fallback only.
    for (const [name, svg] of Object.entries(BUNDLED_ICONS)) {
      this.bundledByName.set(toFileName(name), svg);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // Public API
  // ═════════════════════════════════════════════════════════════════

  /** Resolve an icon name to its asset URL */
  getIconUrl(name: string): string {
    return join(this.basePath, `${toFileName(name)}.svg`);
  }

  /** Convert a size token to a numeric pixel value */
  resolveSize(size: number | string | SizeToken | undefined): string | undefined {
    if (size === undefined) return undefined;
    if (typeof size === 'number') return `${size}`;
    if (size in SIZE_MAP) return `${SIZE_MAP[size as SizeToken]}`;
    return size; // CSS unit string like '1.5rem'
  }

  /** Resolve a semantic color name to its CSS variable expression */
  resolveColor(color?: string, semanticColor?: SemanticColor): string | undefined {
    if (semanticColor && semanticColor !== 'inherit') {
      return SEMANTIC_COLOR_MAP[semanticColor] ?? color;
    }
    return color;
  }

  /**
   * Fetch SVG inline for full control (color, size, stroke).
   * Uses a shared cache so each SVG file is fetched once.
   */
  getIconInline(
    name: string,
    opts: SvgIconOptions = {}
  ): Observable<SafeHtml> {
    const src = this.getIconUrl(name);
    return this.fetchSvg(src).pipe(
      map(svg => this.applyOptions(svg, opts)),
      map(html => this.sanitizer.bypassSecurityTrustHtml(html)),
      catchError(err => {
        console.warn('[SvgIconService] inline load failed:', src, err);
        const placeholder = this.applyOptions(
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"></svg>',
          opts
        );
        return of(this.sanitizer.bypassSecurityTrustHtml(placeholder));
      })
    );
  }

  /** Pre-load one or more icons into cache (e.g. during app init) */
  preload(...names: string[]): void {
    names.forEach(n => this.fetchSvg(this.getIconUrl(n)).subscribe());
  }

  // ═════════════════════════════════════════════════════════════════
  // Private
  // ═════════════════════════════════════════════════════════════════

  /** Cached HTTP fetch — same URL is only fetched once.
   *  On fetch failure (404 / network), falls back to BUNDLED_ICONS content
   *  if present so navbar/dock icons still render offline. */
  private fetchSvg(url: string): Observable<string> {
    if (!this.cache.has(url)) {
      const file = url.split('/').pop() ?? '';
      const key = file.replace(/\.svg$/i, '');
      const bundled = this.bundledByName.get(key);
      const req$ = this.httpRaw.get(url, { responseType: 'text' }).pipe(
        map(text => {
          // Production (S3/CloudFront) returns index.html with HTTP 200 for a MISSING
          // asset (SPA catch-all) instead of a 404 — so catchError never fires and we
          // must not cache that HTML as an "icon". Validate the body is really an SVG;
          // otherwise fall back to the bundled copy, or fail so the placeholder shows.
          if (looksLikeSvg(text)) return text;
          if (bundled) return bundled;
          this.cache.delete(url);
          throw new Error(`[SvgIconService] ${url} returned non-SVG content (HTML fallback?).`);
        }),
        catchError(err => {
          // Network / real 404 — try the bundled fallback before giving up.
          if (bundled) return of(bundled);
          this.cache.delete(url);
          throw err;
        }),
        shareReplay(1),
      );
      this.cache.set(url, req$);
    }
    return this.cache.get(url)!;
  }

  /**
   * Normalize an arbitrary "ready-made" SVG so it inherits the current text
   * color and renders correctly regardless of authoring style:
   *  - Outline icons (Lucide, Feather, Heroicons-outline): root carries
   *    `stroke="currentColor"` + `fill="none"`; interiors must stay transparent.
   *  - Solid icons (Material, Heroicons-solid): glyph drawn with `fill`.
   *  - Mixed icons: root `fill="none"` with children that set their own fill.
   *
   * Any concrete (hex/rgb/named) color is mapped to `currentColor` so the icon
   * follows theme color, while `none`, `url(#...)` and `var(--...)` are kept.
   */
  private normalizeColors(svg: string): string {
    const rootMatch = svg.match(/<svg\b[^>]*>/i);
    const root = rootMatch ? rootMatch[0] : '';

    // Detect outline icons BEFORE rewriting colors below. Outline icons either
    // declare a real stroke or explicitly disable the root fill.
    const hasStroke = /\bstroke="(?!none)[^"]*"/i.test(svg);
    const rootFillNone = /\bfill="none"/i.test(root);
    const isOutline = hasStroke || rootFillNone;

    // 1. Concrete stroke color -> currentColor (preserve none/url/var/currentColor)
    svg = svg.replace(
      /stroke="(?!none|url\(|var\(|currentColor)[^"]*"/gi,
      'stroke="currentColor"'
    );

    // 2. Concrete fill color -> currentColor (preserve none/url/var/currentColor)
    svg = svg.replace(
      /fill="(?!none|url\(|var\(|currentColor)[^"]*"/gi,
      'fill="currentColor"'
    );

    if (isOutline) {
      // Guarantee the root keeps its interior transparent. When `fill` is
      // absent the SVG default is solid black, which flood-fills stroke icons.
      if (!rootFillNone) {
        svg = svg.replace(/<svg\b([^>]*?)(\s*\/?)>/i, (_m, attrs: string, tail: string) => {
          const cleaned = attrs.replace(/\s*fill="currentColor"/i, '');
          return `<svg${cleaned} fill="none"${tail}>`;
        });
      }
    } else if (!/\bfill="/i.test(svg)) {
      // Solid icon with no fill declared anywhere -> make it visible & themable.
      svg = svg.replace(/<svg\b([^>]*?)(\s*\/?)>/i, '<svg$1 fill="currentColor"$2>');
    }

    return svg;
  }

  private applyOptions(raw: string, opts: SvgIconOptions): string {
    let svg = raw.trim();
    const { size, strokeWidth, color, semanticColor } = opts;

    // 1. Resolve size
    const resolvedSize = this.resolveSize(size);
    if (resolvedSize !== undefined) {
      svg = svg.replace(/width="[^"]*"/i, `width="${resolvedSize}"`);
      svg = svg.replace(/height="[^"]*"/i, `height="${resolvedSize}"`);
    }

    // 2. Normalize colors so the icon inherits the current text color,
    //    handling both outline (Lucide/Feather) and solid (Material) glyphs.
    svg = this.normalizeColors(svg);

    // 3. Stroke-width override
    if (strokeWidth !== undefined) {
      svg = svg.match(/stroke-width="/i)
        ? svg.replace(/stroke-width="[^"]*"/gi, `stroke-width="${strokeWidth}"`)
        : svg.replace(/<svg([^>]*)>/i, `<svg$1 stroke-width="${strokeWidth}">`);
    }

    // 4. Color — resolve semantic name, then inject as inline style
    const resolvedColor = this.resolveColor(color, semanticColor);
    if (resolvedColor) {
      svg = svg.replace(/<svg([^>]*)>/i, `<svg$1 style="color:${resolvedColor}">`);
    }

    return svg;
  }
}
