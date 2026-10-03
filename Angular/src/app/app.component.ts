import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { UploadFilesComponent } from './components/upload-files/upload-files.component';
import { AgentQaComponent } from './components/agent-qa/agent-qa.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatTabsModule,
    MatIconModule,
    UploadFilesComponent,
    AgentQaComponent
  ],
  template: `
    <div class="min-h-screen bg-slate-100 flex flex-col font-sans">
      <!-- Top Navigation Header -->
      <mat-toolbar color="primary" class="!bg-slate-900 !text-white flex justify-between px-6 shadow-md border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
            🅰
          </div>
          <div>
            <span class="font-bold text-base tracking-tight">Enterprise Angular RAG Application</span>
            <span class="text-xs text-slate-400 block">Angular 19 Frontend connected to ASP.NET Core 9 &amp; MS SQL Server 2025</span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 text-slate-300">
            MS SQL Server Vector Store
          </span>
          <span class="bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-700 text-indigo-300">
            Gemini AI
          </span>
        </div>
      </mat-toolbar>

      <!-- Main Container with ONLY the two specified tabs -->
      <main class="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1">
        <mat-tab-group animationDuration="150ms" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <!-- TAB 1: Upload Files -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2 !text-indigo-600">upload_file</mat-icon>
              Upload Files
            </ng-template>
            <div class="p-6">
              <app-upload-files></app-upload-files>
            </div>
          </mat-tab>

          <!-- TAB 2: Agent Q&A (Vector + Gemini) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2 !text-indigo-600">psychology</mat-icon>
              Agent Q&amp;A (Vector + Gemini)
            </ng-template>
            <div class="p-6">
              <app-agent-qa></app-agent-qa>
            </div>
          </mat-tab>
        </mat-tab-group>
      </main>

      <!-- Footer -->
      <footer class="bg-white border-t border-slate-200 py-3 px-6 text-center text-xs text-slate-500">
        Enterprise Angular &amp; .NET MS SQL Server Vector Architecture with Gemini AI
      </footer>
    </div>
  `
})
export class AppComponent {
  title = 'Enterprise RAG Angular Client';
}
