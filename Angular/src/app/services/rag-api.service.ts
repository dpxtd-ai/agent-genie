import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { DocumentRecord, RagChatResponse, RagChatRequest } from '../models/rag.models';

@Injectable({
  providedIn: 'root'
})
export class RagApiService {
  private http = inject(HttpClient);
  // Default URL to .NET 9 Web API backend (can be relative in production or localhost:5000 in dev)
  private readonly baseUrl = '/api';

  documents = signal<DocumentRecord[]>([]);
  isLoading = signal<boolean>(false);
  activeError = signal<string | null>(null);

  normalizeHttpError(err: any): string {
    if (err.status === 0 || err.name === 'HttpErrorResponse' && !err.status) {
      return 'Unable to connect to .NET Backend API Server (http://localhost:5000). Please ensure your .NET Web API is running.';
    }
    if (err.status === 503 && err.error?.errorCode === 'ERR_DATABASE_UNAVAILABLE') {
      return 'Unable to connect to MS SQL Server Database. Check your connection string in /DotNet/appsettings.json.';
    }
    if (err.status === 503 && err.error?.errorCode === 'ERR_GEMINI_UNAVAILABLE') {
      return 'Unable to connect to Google Gemini AI. Check Gemini:ApiKey in /DotNet/appsettings.json.';
    }
    return err.error?.message || err.message || 'An unexpected error occurred';
  }

  getDocuments(): Observable<DocumentRecord[]> {
    this.isLoading.set(true);
    return this.http.get<DocumentRecord[]>(`${this.baseUrl}/documents`).pipe(
      tap({
        next: (docs) => {
          this.documents.set(docs);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      })
    );
  }

  uploadDocument(formData: FormData): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.baseUrl}/documents/upload`, formData).pipe(
      tap({
        next: () => this.getDocuments().subscribe(),
        complete: () => this.isLoading.set(false)
      })
    );
  }

  askAgent(request: RagChatRequest): Observable<RagChatResponse> {
    return this.http.post<RagChatResponse>(`${this.baseUrl}/rag/chat`, request);
  }

  deleteDocument(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/documents/${id}`).pipe(
      tap(() => this.getDocuments().subscribe())
    );
  }
}
