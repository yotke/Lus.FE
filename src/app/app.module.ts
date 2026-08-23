import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MaterialModule } from './Infrastructure/material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DataLoaderComponent } from './Activities/data-loader/data-loader.component';
import { ProjectsManagerComponent } from './Activities/projects-manager/projects-manager.component';
import { CreateProjectComponent } from './Activities/create-project/create-project.component';
import { AuthService } from './Infrastructure/Services/Auth/auth.service';
import { JWT_OPTIONS, JwtHelperService, JwtModule } from '@auth0/angular-jwt';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { environment } from 'src/environments/environment';
import { LoadingInterceptor } from './Adapters/Interceptors/loading/loading.interceptor';
import { ProgressToastComponent } from './Adapters/Common/progress-toast/progress-toast.component';
import { CreateChooserComponent } from './Adapters/Common/create-chooser/create-chooser.component';
import { DocumentBuilderComponent } from './Activities/document-builder/document-builder.component';
import { ExcelCanvasComponent } from './Activities/document-builder/excel-canvas/excel-canvas.component';
import { BuilderChatRailComponent } from './Activities/document-builder/builder-chat-rail/builder-chat-rail.component';
import { API_BASE_URL, getBaseUrl } from './Infrastructure/Classes & Models/customClasses/api-base-url.token';
import { HomeComponent } from './Adapters/HomePageComponents/home/home.component';
import { MatStepperModule } from '@angular/material/stepper';
import { HeaderComponent } from './Adapters/HomePageComponents/header/header.component';
import { ExcelExportComponent } from './Activities/excel-export/excel-export.component';
import { ProjectValidatorComponent } from './Activities/project-validator/project-validator.component';
import { HistoryProjectsComponent } from './Activities/history-projects/history-projects.component';
import { ProjectRowComponent } from './Activities/history-projects/project-row/project-row.component';
import { ProjectTextRowComponent } from './Activities/history-projects/project-text-row/project-text-row.component';
import { LoginComponent } from './Activities/login/login.component';
import { RegisterComponent } from './Activities/register/register.component';
import { PrivacyComponent } from './Activities/legal/privacy.component';
import { TermsComponent } from './Activities/legal/terms.component';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonHelpersModule } from './Adapters/Common/common-helpers.module';
import { AuthInterceptor } from './Adapters/Interceptors/auth.interceptors/auth.interceptor';
import { CsrfInterceptor } from './Adapters/Interceptors/auth.interceptors/csrf.interceptor';
import { HttpErrorInterceptor } from './Adapters/Interceptors/error/http-error-interceptor';
// import { RECAPTCHA_V3_SITE_KEY, ReCaptchaV3Service, RecaptchaModule } from 'ng-recaptcha';


// Re-exported so existing `from './app.module'` imports keep working; the token itself
// now lives outside the module to keep services from importing the module back.
export { API_BASE_URL, getBaseUrl } from './Infrastructure/Classes & Models/customClasses/api-base-url.token';

// Loads translation JSON from /assets/i18n/<lang>.json
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}
declare var $: any;


@NgModule({
  declarations: [
    AppComponent,
    DataLoaderComponent,
    ProjectsManagerComponent,
    CreateProjectComponent,
    HomeComponent,
    HeaderComponent,
    ExcelExportComponent,
    ProjectValidatorComponent,
    HistoryProjectsComponent,
    ProjectRowComponent,
    ProjectTextRowComponent,
    LoginComponent,
    RegisterComponent,
    PrivacyComponent,
    TermsComponent,
    ProgressToastComponent,
    CreateChooserComponent,
    DocumentBuilderComponent,
    ExcelCanvasComponent,
    BuilderChatRailComponent,

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MaterialModule,
    FormsModule,
    NgSelectModule,
    MatPaginatorModule,
    CommonModule,
    BrowserAnimationsModule,
    MatInputModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    // NgxMatTimepickerModule.setLocale('en-GB'),
    // NgxMatTimepickerModule.setLocale('he-IL'),
    JwtModule,
    MatStepperModule,
    // RecaptchaModule,
    CommonHelpersModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
      defaultLanguage: 'he',
    })

  ],
  providers: [

    { provide: API_BASE_URL, useFactory: getBaseUrl },
    { provide: JWT_OPTIONS, useValue: JWT_OPTIONS }, JwtHelperService,
    // { provide: RECAPTCHA_V3_SITE_KEY, useValue: environment.recaptcha.siteKey },
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    provideHttpClient(
      withInterceptorsFromDi()  // Enable DI-based interceptors
  ),
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: CsrfInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true },
    { provide: MAT_DATE_LOCALE, useValue: 'he-IL' },
    AuthService,
    { provide: DatePipe },
    // { provide: ReCaptchaV3Service },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
