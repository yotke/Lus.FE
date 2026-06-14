import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { CreateProjectComponent } from './create-project.component';
import { ProjectTemplate } from 'src/app/Infrastructure/Classes & Models/Classes/project-template';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';

describe('CreateProjectComponent', () => {
  let component: CreateProjectComponent;
  let projectSvc: any;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    projectSvc = {
      CreateNewProject: jasmine.createSpy('CreateNewProject'),
      ModifyProject: jasmine.createSpy('ModifyProject'),
    };
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'errorFrom']);
    component = new CreateProjectComponent(new FormBuilder(), projectSvc, notify);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a success message after creating a project', () => {
    const saved = { Id: 12, Name: 'פרויקט חדש' } as ProjectTemplate;
    projectSvc.CreateNewProject.and.returnValue(of(saved));
    spyOn(component.OnSaveCallback, 'emit');
    component.CurrProject = new ProjectTemplate();
    component.CreateProjectForm.patchValue({ Name: 'פרויקט חדש' });

    component.onFormSubmit();

    expect(projectSvc.CreateNewProject).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('הפרויקט נוצר בהצלחה.');
    expect(component.OnSaveCallback.emit).toHaveBeenCalledWith(saved);
  });

  it('shows an error message when saving fails', () => {
    const err = new Error('fail');
    projectSvc.ModifyProject.and.returnValue(throwError(() => err));
    component.CurrProject = { Id: 5 } as ProjectTemplate;

    component.onFormSubmit();

    expect(projectSvc.ModifyProject).toHaveBeenCalled();
    expect(notify.errorFrom).toHaveBeenCalledWith(err, 'שמירת הפרויקט נכשלה. אנא נסו שוב.');
  });
});
