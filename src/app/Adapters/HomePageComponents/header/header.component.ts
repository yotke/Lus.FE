import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectTemplateService } from 'src/app/Infrastructure/Services/projectTemplateService/project-template.service';
import { AuthService } from 'src/app/Infrastructure/Services/Auth/auth.service';
import { ThemeService } from 'src/app/Infrastructure/Services/themeService/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  isScrolledDown: boolean = false;
  verticalPosition: number;
  CurrSystemDate: Date;
  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolledDown = this.checkScrollPosition();
  }

  constructor(
    private projectTemplateSvc: ProjectTemplateService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {
    const storedDate = sessionStorage.getItem('currSystemDate');
    if (storedDate) {
      this.CurrSystemDate = new Date(JSON.parse(storedDate));
      this.projectTemplateSvc.updateSystemDate(this.CurrSystemDate); // Update service state
    }
  }

  onCurrSystemDateChange(newDate: Date) {
    this.CurrSystemDate = newDate; // Update component state
    this.projectTemplateSvc.updateSystemDate(newDate); // Update service state
    sessionStorage.removeItem('currSystemDate');
    // Store new date to session storage
    sessionStorage.setItem('currSystemDate', JSON.stringify(this.CurrSystemDate));
  }

  checkScrollPosition() {
    const verticalPosition = window?.pageYOffset || document?.documentElement?.scrollTop || document?.body?.scrollTop || 0;
    this.verticalPosition = verticalPosition;
    return verticalPosition > 0;
  }

  get isLoggedIn$() {
    return this.authService.isLoggedIn$;
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/Login']);
    });
  }
}
