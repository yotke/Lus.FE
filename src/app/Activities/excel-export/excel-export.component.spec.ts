import { ExcelExportComponent } from './excel-export.component';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';

describe('ExcelExportComponent', () => {
  let component: ExcelExportComponent;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'warning', 'errorFrom']);
    component = new ExcelExportComponent({} as any, notify);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('warns and does not export when collisions exist', () => {
    component.hasCollision = true;

    component.createExels();

    expect(notify.warning).toHaveBeenCalledWith('לא ניתן לייצא לפני תיקון התנגשויות השעות.');
  });
});
