import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './Adapters/HomePageComponents/home/home.component';
import { ProjectsManagerComponent } from './Activities/projects-manager/projects-manager.component';
import { HistoryProjectsComponent } from './Activities/history-projects/history-projects.component';
import { LoginComponent } from './Activities/login/login.component';
import { RegisterComponent } from './Activities/register/register.component';
import { PrivacyComponent } from './Activities/legal/privacy.component';
import { TermsComponent } from './Activities/legal/terms.component';
import { authGuard } from './Infrastructure/Services/Auth/AuthGuard/auth-guard';

const routes: Routes = [
  // Default: send to login; the guard forwards authenticated users on to Home.
  { path: '', redirectTo: 'Home', pathMatch: 'full', data: { breadcrumb: 'דף הבית', roles: [] } },

  // Public — the only routes reachable without a session.
  { path: 'Login', component: LoginComponent, data: { breadcrumb: 'התחברות', roles: [] } },
  { path: 'Register', component: RegisterComponent, data: { breadcrumb: 'הרשמה', roles: [] } },
  { path: 'Privacy', component: PrivacyComponent, data: { breadcrumb: 'מדיניות פרטיות', roles: [] } },
  { path: 'Terms', component: TermsComponent, data: { breadcrumb: 'תנאי שימוש', roles: [] } },

  // Everything below requires authentication.
  { path: 'Home', component: HomeComponent, canActivate: [authGuard], data: { breadcrumb: 'דף הבית', roles: [] } },
  { path: 'TimeManagement', component: ProjectsManagerComponent, canActivate: [authGuard], data: { breadcrumb: 'ניהול פרויקטים', roles: [] } },
  { path: 'History', component: HistoryProjectsComponent, canActivate: [authGuard], data: { breadcrumb: 'צפייה בהיסטורית פרויקטים', roles: [] } },

  // Unknown routes -> login (which forwards to Home if already authenticated).
  { path: '**', redirectTo: 'Login' },
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
