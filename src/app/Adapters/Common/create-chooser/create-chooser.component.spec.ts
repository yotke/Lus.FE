import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CreateChooserComponent } from './create-chooser.component';

describe('CreateChooserComponent', () => {
  let fixture: ComponentFixture<CreateChooserComponent>;
  let component: CreateChooserComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreateChooserComponent],
      imports: [TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateChooserComponent);
    component = fixture.componentInstance;
  });

  function panel(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.create-chooser-panel');
  }

  it('renders nothing while closed', () => {
    component.open = false;
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('renders both lanes when open', () => {
    component.open = true;
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.create-chooser-card');
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.querySelector('.create-chooser-card--ai')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.create-chooser-card-badge')).toBeTruthy();
  });

  it('emits the classic choice from the first card', () => {
    component.open = true;
    fixture.detectChanges();
    spyOn(component.chooseClassic, 'emit');

    fixture.nativeElement.querySelectorAll('.create-chooser-card')[0].click();

    expect(component.chooseClassic.emit).toHaveBeenCalled();
  });

  it('emits the AI choice from the AI card', () => {
    component.open = true;
    fixture.detectChanges();
    spyOn(component.chooseAi, 'emit');

    fixture.nativeElement.querySelector('.create-chooser-card--ai').click();

    expect(component.chooseAi.emit).toHaveBeenCalled();
  });

  it('closes on the backdrop', () => {
    component.open = true;
    fixture.detectChanges();
    spyOn(component.closed, 'emit');

    fixture.nativeElement.querySelector('.create-chooser-backdrop').click();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('does not close when the panel itself is clicked', () => {
    component.open = true;
    fixture.detectChanges();
    spyOn(component.closed, 'emit');

    panel()!.click();

    expect(component.closed.emit).not.toHaveBeenCalled();
  });

  it('closes on escape, but only while open', () => {
    spyOn(component.closed, 'emit');

    component.open = false;
    component.onEscape();
    expect(component.closed.emit).not.toHaveBeenCalled();

    component.open = true;
    component.onEscape();
    expect(component.closed.emit).toHaveBeenCalled();
  });
});
