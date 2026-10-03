import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RagApiService } from '../../services/rag-api.service';
import { ChatMessage } from '../../models/rag.models';

@Component({
  selector: 'app-agent-qa',
  standalone: true,
  imports: [CommonModule, FormsModule, MatInputModule, MatButtonModule, MatIconModule, MatChipsModule],
  template: `
    <div class="chat-container flex flex-col h-[700px] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <!-- Chat Header -->
      <div class="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
            <mat-icon class="!w-5 !h-5 !text-xl">psychology</mat-icon>
          </div>
          <div>
            <h3 class="font-bold text-sm">Agent Q&amp;A (Vector + Gemini)</h3>
            <p class="text-[11px] text-slate-400">
              Flow: Query &rarr; Vectorize &rarr; MS SQL Cosine Search &rarr; Gemini LLM &rarr; Response
            </p>
          </div>
        </div>
      </div>

      <!-- Messages Stream -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
        <div *ngFor="let msg of messages()" [ngClass]="msg.role === 'user' ? 'text-right' : 'text-left'">
          <div [ngClass]="msg.role === 'user' ? 'bg-indigo-600 text-white ml-auto' : 'bg-white text-slate-800 border border-slate-200'"
               class="inline-block max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-xs">
            <p class="whitespace-pre-line leading-relaxed">{{ msg.text }}</p>

            <!-- Agent Clarifying Question Box -->
            <div *ngIf="msg.clarification" class="mt-3 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs">
              <div class="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                <mat-icon class="!w-4 !h-4 !text-base">help_outline</mat-icon>
                <span>Agent Clarifying Question:</span>
              </div>
              <p class="font-medium">{{ msg.clarification }}</p>
              <div class="mt-2.5 flex gap-2">
                <button mat-stroked-button class="!text-[11px] !bg-white !text-amber-900" (click)="replyWithClarification('Please provide the full policy guidelines.')">
                  Provide full policy
                </button>
              </div>
            </div>

            <!-- Grounded Citations from MS SQL Server -->
            <div *ngIf="msg.retrievedChunks?.length" class="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
              <span class="font-semibold text-slate-700">MS SQL Server Vectors:</span>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span *ngFor="let c of msg.retrievedChunks" class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 text-[10px] font-mono">
                  {{ c.fileName }} (Part {{ c.chunkIndex + 1 }}) - {{ (c.similarityScore * 100).toFixed(0) }}% match
                </span>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="isLoading()" class="flex items-center gap-2 text-xs text-slate-500 italic p-3 bg-white rounded-xl border border-slate-200 inline-block shadow-2xs">
          <span>Querying MS SQL vector store &amp; generating grounded Gemini response...</span>
        </div>
      </div>

      <!-- Quick Suggested Prompts -->
      <div class="px-4 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto flex gap-2">
        <button *ngFor="let p of starterPrompts" (click)="sendMessage(p)" 
                class="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 whitespace-nowrap transition cursor-pointer">
          💡 {{ p }}
        </button>
      </div>

      <!-- Input Bar -->
      <div class="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input [(ngModel)]="userQuery" (keyup.enter)="sendMessage()"
               placeholder="Ask questions about SLA, employee leave, or incident response..."
               class="flex-1 px-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button mat-raised-button color="primary" class="!bg-indigo-600 !text-white !font-semibold !rounded-xl" (click)="sendMessage()" [disabled]="isLoading() || !userQuery.trim()">
          <mat-icon>send</mat-icon> Ask Agent
        </button>
      </div>
    </div>
  `
})
export class AgentQaComponent {
  private ragService = inject(RagApiService);
  messages = signal<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      text: `Hello! I am your Enterprise RAG Agent.
When you ask a question:
1. Your question is converted into a vector format.
2. It queries our MS SQL Server database to fetch existing vectors and compute cosine distances.
3. The retrieved vector chunks are forwarded to Gemini AI (LLM).
4. I formulate an authoritative response with citations and ask clarifying questions when appropriate.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  userQuery = '';
  isLoading = signal(false);

  starterPrompts = [
    'What is our disaster recovery RPO and RTO SLA target?',
    'How many weeks of fully paid parental leave are primary caregivers entitled to?',
    'What is the network isolation protocol during a security breach?',
    'What wellness stipends and remote allowances do employees receive?'
  ];

  sendMessage(overrideQuery?: string) {
    const query = overrideQuery || this.userQuery;
    if (!query.trim()) return;
    this.userQuery = '';

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.messages.update((prev) => [...prev, userMsg]);
    this.isLoading.set(true);

    this.ragService.askAgent({ query, topK: 4 }).subscribe({
      next: (res) => {
        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: res.answer,
          clarification: res.clarificationQuestion,
          retrievedChunks: res.retrievedChunks,
          sqlExecutionQuery: res.sqlExecutionQuery,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        this.messages.update((prev) => [...prev, agentMsg]);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.messages.update((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'agent',
            text: 'Error in RAG pipeline: ' + err.message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        this.isLoading.set(false);
      }
    });
  }

  replyWithClarification(text: string) {
    this.sendMessage(text);
  }
}
