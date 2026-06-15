import { Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TabNavWidgetService } from './Infrastructure/Services/TabNav/tab-nav-widget.service';
import { ThemeService } from './Infrastructure/Services/themeService/theme.service';
import { LanguageService } from './Infrastructure/Services/languageService/language.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Loz-Information';
  // The app shell (nav bar) is hidden on the public / authentication routes.
  private static readonly PUBLIC_ROUTES = ['/login', '/register', '/privacy', '/terms'];
  showHeader: boolean = false;
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    // Injected so the accessibility widget is loaded once for the whole app.
    private tabNavWidget: TabNavWidgetService,
    // Injected so the theme (light/dark + brand CSS vars) initializes once on
    // app startup, restoring the user's saved mode from localStorage.
    private themeService: ThemeService,
    // Injected so i18n initializes once for the whole app (the service applies
    // the saved/default language + dir in its own constructor, ArmyLuz pattern).
    private languageService: LanguageService
  ) {
  }
  ngOnInit(): void {
    this.updateHeaderVisibility(this.router.url);
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateHeaderVisibility(event.urlAfterRedirects);
      }
    });
  }

  private updateHeaderVisibility(url: string): void {
    const path = (url.split('?')[0].split('#')[0] || '').toLowerCase();
    this.showHeader = !AppComponent.PUBLIC_ROUTES.some(
      route => path === route || path.startsWith(`${route}/`)
    );
  }

}
