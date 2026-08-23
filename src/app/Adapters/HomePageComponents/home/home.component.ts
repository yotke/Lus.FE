import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  /** One entry point; the chooser explains the two lanes behind it. */
  chooserOpen = false;

  constructor(private router: Router) { }

  openChooser(): void { this.chooserOpen = true; }
  closeChooser(): void { this.chooserOpen = false; }
  navigateToTimeManagement() {
    this.chooserOpen = false;
    this.router.navigate(['/TimeManagement']);
  }

  /** The other lane: same kind of document, built by talking to it instead of filling it in. */
  navigateToDocumentBuilder() {
    this.chooserOpen = false;
    this.router.navigate(['/DocumentBuilder']);
  }
}
