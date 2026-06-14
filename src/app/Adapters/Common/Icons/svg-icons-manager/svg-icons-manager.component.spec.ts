import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';


import { SvgIconsManagerComponent } from './svg-icons-manager.component';

describe('SvgIconsManagerComponent', () => {
  let component: SvgIconsManagerComponent;
  let fixture: ComponentFixture<SvgIconsManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      providers: [DatePipe, { provide: ActivatedRoute, useValue: { snapshot: { routeConfig: null, data: {}, params: {}, queryParams: {} }, firstChild: null, children: [], params: { pipe: () => ({ subscribe: () => {} }) }, queryParams: { pipe: () => ({ subscribe: () => {} }) }, paramMap: { pipe: () => ({ subscribe: () => {} }) }, queryParamMap: { pipe: () => ({ subscribe: () => {} }) } } }, { provide: MAT_DIALOG_DATA, useValue: {} }, { provide: MatDialogRef, useValue: { close: () => {} } }],
      imports: [HttpClientTestingModule, TranslateModule.forRoot(), RouterTestingModule],
      declarations: [ SvgIconsManagerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SvgIconsManagerComponent);
    component = fixture.componentInstance;

  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
