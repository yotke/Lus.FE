import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent implements OnInit {
  title = 'ngx-skeleton-loader';

  animation = 'pulse';
  contentLoaded = false;
  count = 2;
  widthHeightSizeInPixels = 50;
  intervalId: number | null = null;
  // Resolved in TS (this component is rendered via a CDK portal, outside a
  // module that provides the translate pipe).
  loadingText = 'טוען...';

  constructor(private translate: TranslateService) {
    this.loadingText = this.translate.instant('common.loading');
  }

  ngOnInit() {
    // setTimeout(() => {
    //   this.contentLoaded = true;
    // }, 2000);
    // this.intervalId = window.setInterval(() => {
    //   this.animation = this.animation === 'pulse' ? 'progress-dark' : 'pulse';
    //   this.count = this.count === 2 ? 5 : 2;
    //   this.widthHeightSizeInPixels =
    //     this.widthHeightSizeInPixels === 50 ? 100 : 50;
    // }, 5000);
  }

  ngOnDestroy() {
    // if (this.intervalId) {
    //   clearInterval(this.intervalId);
    // }
  }
}


