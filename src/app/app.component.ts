import { Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TabNavWidgetService } from './Infrastructure/Services/TabNav/tab-nav-widget.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Loz-Information';
  isHomePage: boolean = true;
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    // Injected so the accessibility widget is loaded once for the whole app.
    private tabNavWidget: TabNavWidgetService
  ) {

  }
  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isHomePage = event.urlAfterRedirects === '/Home';
      }
    });
  }

}
