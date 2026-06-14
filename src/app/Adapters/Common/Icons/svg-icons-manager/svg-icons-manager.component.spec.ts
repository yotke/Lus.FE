import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SvgIconsManagerComponent } from './svg-icons-manager.component';
import { SvgIconService } from 'src/app/Infrastructure/Services/icons/svg-icon.service';

describe('SvgIconsManagerComponent', () => {
  let component: SvgIconsManagerComponent;
  let fixture: ComponentFixture<SvgIconsManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [SvgIconsManagerComponent],
      providers: [SvgIconService],
    }).compileComponents();

    fixture = TestBed.createComponent(SvgIconsManagerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resolves a size token to pixels on change', () => {
    component.name = 'add';
    component.size = 'lg';
    component.ngOnChanges();
    expect(component.sizeCss).toBe('24px');
  });

  it('marks decorative icons aria-hidden', () => {
    component.ariaLabel = undefined;
    expect(component.hostAriaHidden).toBe('true');
    component.ariaLabel = 'Add';
    expect(component.hostAriaHidden).toBeNull();
  });
});
