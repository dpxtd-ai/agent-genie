import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RagApiService } from '../../services/rag-api.service';
import { DocumentRecord } from '../../models/rag.models';

@Component({
  selector: 'app-upload-files',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressBarModule, MatIconModule, MatTableModule],
  template: `
    <div class="space-y-6">
      <!-- File Upload Dropzone -->
      <div class="border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-8 text-center bg-indigo-50/20 transition">
        <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf,.docx,.doc,.txt,.md,.json" hidden />
        
        <div class="flex flex-col items-center gap-3">
          <div class="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <mat-icon class="!w-8 !h-8 !text-3xl">cloud_upload</mat-icon>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-800">Browse &amp; Upload Files for Vectorization</h3>
            <p class="text-xs text-slate-500 mt-1">Supports PDF, Word (.docx), Plain Text. The .NET backend chunks the document, converts to 768-d vectors via Gemini, and commits into MS SQL Server.</p>
          </div>
          
          <button mat-raised-button color="primary" class="!bg-indigo-600 !text-white !font-semibold" (click)="fileInput.click()" [disabled]="isUploading()">
            Browse File
          </button>

          <mat-progress-bar *ngIf="isUploading()" mode="indeterminate" class="w-64 mt-3"></mat-progress-bar>

          <div *ngIf="statusMessage()" class="text-xs font-semibold mt-2" [ngClass]="isSuccess() ? 'text-emerald-700' : 'text-rose-700'">
            {{ statusMessage() }}
          </div>
        </div>
      </div>

      <!-- Indexed MS SQL Vector Documents Table -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <mat-icon class="!text-indigo-600 !w-5 !h-5 !text-xl">storage</mat-icon>
            MS SQL Server 2025 Vector Store (dbo.Documents &amp; dbo.DocumentChunks)
          </h4>
          <button mat-button color="primary" (click)="loadDocuments()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        <table mat-table [dataSource]="ragService.documents()" class="w-full">
          <!-- File Name -->
          <ng-container matColumnDef="fileName">
            <th mat-header-cell *matHeaderCellDef class="font-bold text-xs uppercase">File Name</th>
            <td mat-cell *matCellDef="let doc" class="font-semibold text-xs text-slate-900">{{ doc.fileName }}</td>
          </ng-container>

          <!-- Format -->
          <ng-container matColumnDef="fileType">
            <th mat-header-cell *matHeaderCellDef class="font-bold text-xs uppercase">Format</th>
            <td mat-cell *matCellDef="let doc" class="text-xs uppercase font-medium">{{ doc.fileType }}</td>
          </ng-container>

          <!-- Vector Chunks -->
          <ng-container matColumnDef="chunkCount">
            <th mat-header-cell *matHeaderCellDef class="font-bold text-xs uppercase">Vector Chunks</th>
            <td mat-cell *matCellDef="let doc" class="text-xs font-mono font-bold text-indigo-700">
              {{ doc.chunkCount }} chunks (VECTOR[768])
            </td>
          </ng-container>

          <!-- Status -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef class="font-bold text-xs uppercase">Status</th>
            <td mat-cell *matCellDef="let doc" class="text-xs text-emerald-700 font-semibold">
              ✓ Stored in MS SQL Server
            </td>
          </ng-container>

          <!-- Actions -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="font-bold text-xs uppercase text-right">Action</th>
            <td mat-cell *matCellDef="let doc" class="text-right">
              <button mat-icon-button color="warn" (click)="deleteDoc(doc.documentId, doc.fileName)">
                <mat-icon class="!text-rose-600">delete_outline</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>
    </div>
  `
})
export class UploadFilesComponent implements OnInit {
  ragService = inject(RagApiService);
  isUploading = signal(false);
  isSuccess = signal(false);
  statusMessage = signal<string | null>(null);
  displayedColumns = ['fileName', 'fileType', 'chunkCount', 'status', 'actions'];

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.ragService.getDocuments().subscribe();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.isUploading.set(true);
      this.statusMessage.set(`Uploading ${file.name} to .NET API -> Chunking -> Embedding -> MS SQL Server...`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      this.ragService.uploadDocument(formData).subscribe({
        next: (res) => {
          this.isUploading.set(false);
          this.isSuccess.set(true);
          this.statusMessage.set(`✓ "${file.name}" converted to vector format and stored in MS SQL Server!`);
        },
        error: (err) => {
          this.isUploading.set(false);
          this.isSuccess.set(false);
          this.statusMessage.set('Upload error: ' + err.message);
        }
      });
    }
  }

  deleteDoc(id: string, name: string) {
    if (confirm(`Delete "${name}" from MS SQL Server?`)) {
      this.ragService.deleteDocument(id).subscribe();
    }
  }
}
