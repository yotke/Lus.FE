import { DatePipe } from '@angular/common';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { DataLoaderComponent } from './data-loader.component';
import { ProjectTemplate } from 'src/app/Infrastructure/Classes & Models/Classes/project-template';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';

describe('DataLoaderComponent', () => {
  let component: DataLoaderComponent;
  let projectTimeSvc: any;
  let projectSvc: any;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    projectTimeSvc = {
      ModifyProject: jasmine.createSpy('ModifyProject'),
      DeleteProjectTime: jasmine.createSpy('DeleteProjectTime'),
    };
    projectSvc = {
      notifyProjectChange: jasmine.createSpy('notifyProjectChange'),
      GetAllProjects: of([]),
    };
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'info', 'errorFrom']);
    component = new DataLoaderComponent(projectTimeSvc, projectSvc, new FormBuilder(), new DatePipe('he-IL'), notify);
    component.CurrProject = { Id: 1, ProjectTimes: [] } as unknown as ProjectTemplate;
    component.ProjectId = 1;
    component.initProjectForm(component.CurrProject);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a success message after saving project times', () => {
    projectTimeSvc.ModifyProject.and.returnValue(of([]));

    component.onFormSubmit();

    expect(projectTimeSvc.ModifyProject).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('נתוני השעות נשמרו בהצלחה.');
    expect(projectSvc.notifyProjectChange).toHaveBeenCalledWith(true);
  });

  it('shows an error message when saving project times fails', () => {
    const err = new Error('save failed');
    projectTimeSvc.ModifyProject.and.returnValue(throwError(() => err));

    component.onFormSubmit();

    expect(notify.errorFrom).toHaveBeenCalledWith(err, 'שמירת נתוני השעות נכשלה. אנא נסו שוב.');
  });

  it('shows a success message after deleting a persisted row', () => {
    projectTimeSvc.DeleteProjectTime.and.returnValue(of({}));
    component.DateTimeFormArray.at(0).get('Id')?.setValue(44);

    component.RemoveDateTimeRow(0);

    expect(projectTimeSvc.DeleteProjectTime).toHaveBeenCalledWith(44);
    expect(notify.success).toHaveBeenCalledWith('שורת השעות נמחקה בהצלחה.');
  });
});
