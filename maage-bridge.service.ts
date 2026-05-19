/**
 * MAAGE Bridge Service for MicrobeTrace (Angular)
 *
 * This Angular service enables bidirectional communication between MicrobeTrace
 * (when embedded in an iframe) and the MAAGE-Web platform.
 *
 * Installation:
 * 1. Copy this file to microbetrace-src/src/app/services/maage-bridge.service.ts
 * 2. Add to providers in app.module.ts
 * 3. Inject into app.component.ts and call init() in ngOnInit()
 *
 * Example usage in app.component.ts:
 *   constructor(private maageBridge: MaageBridgeService) {}
 *   ngOnInit() {
 *     this.maageBridge.init();
 *   }
 */

import { Injectable } from '@angular/core';
// Import your CommonService - adjust path as needed
// import { CommonService } from './common.service';

export interface MaageMessage {
  source: 'maage' | 'microbetrace';
  type: string;
  url?: string;
  fileType?: string;
  filename?: string;
  workspacePath?: string;
  sessionData?: any;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MaageBridgeService {
  private isEmbedded = false;
  private isReady = false;

  // Inject CommonService when available
  // constructor(private common: CommonService) {}
  constructor() {}

  /**
   * Initialize the bridge service
   */
  init(): void {
    this.detectEmbedding();
    this.initMessageListener();
    console.log('[MAAGE Bridge] Initialized, embedded:', this.isEmbedded);
  }

  /**
   * Check if running inside an iframe
   */
  private detectEmbedding(): void {
    try {
      this.isEmbedded = window.self !== window.top;
    } catch (e) {
      this.isEmbedded = true;
    }
  }

  /**
   * Set up message listener for postMessage communication
   */
  private initMessageListener(): void {
    window.addEventListener('message', async (event: MessageEvent<MaageMessage>) => {
      if (!event.data || event.data.source !== 'maage') {
        return;
      }

      console.log('[MAAGE Bridge] Received message:', event.data.type);

      switch (event.data.type) {
        case 'LOAD_DATA':
          await this.loadDataFromUrl(
            event.data.url!,
            event.data.fileType!,
            event.data.filename!
          );
          break;

        case 'REQUEST_SAVE':
          this.sendSessionToParent();
          break;

        default:
          console.warn('[MAAGE Bridge] Unknown message type:', event.data.type);
      }
    });

    // Notify parent that MicrobeTrace is ready
    if (this.isEmbedded) {
      // Wait a moment for MicrobeTrace to fully initialize
      setTimeout(() => this.notifyReady(), 500);
    }
  }

  /**
   * Notify parent frame that MicrobeTrace is ready
   */
  private notifyReady(): void {
    this.isReady = true;
    window.parent.postMessage({
      source: 'microbetrace',
      type: 'READY'
    }, '*');
    console.log('[MAAGE Bridge] Sent READY notification to parent');
  }

  /**
   * Load data from a workspace URL
   */
  private async loadDataFromUrl(url: string, fileType: string, filename: string): Promise<void> {
    try {
      console.log('[MAAGE Bridge] Loading data:', filename, 'type:', fileType);

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text();
      await this.processData(data, fileType, filename);

    } catch (error: any) {
      console.error('[MAAGE Bridge] Error loading data:', error);
      this.sendError(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Process loaded data based on file type
   */
  private async processData(data: string, fileType: string, filename: string): Promise<void> {
    try {
      // Clear existing data
      // this.common.reset();

      switch (fileType.toLowerCase()) {
        case 'fasta':
        case 'fa':
        case 'fna':
        case 'faa':
          this.loadFastaData(data);
          break;

        case 'csv':
          this.loadDelimitedData(data, ',');
          break;

        case 'tsv':
          this.loadDelimitedData(data, '\t');
          break;

        case 'nwk':
        case 'newick':
          this.loadNewickData(data);
          break;

        case 'json':
        case 'microbetrace':
          this.loadSessionData(data);
          break;

        default:
          console.warn('[MAAGE Bridge] Unknown file type:', fileType);
          this.autoDetectAndLoad(data, filename);
      }

      console.log('[MAAGE Bridge] Data loaded successfully');

      // Trigger visualization update
      // this.common.updateVisualization();

    } catch (error: any) {
      console.error('[MAAGE Bridge] Error processing data:', error);
      this.sendError(`Failed to process data: ${error.message}`);
    }
  }

  /**
   * Parse and load FASTA data
   */
  private loadFastaData(data: string): void {
    const sequences = this.parseFasta(data);
    console.log('[MAAGE Bridge] Parsed', sequences.length, 'sequences from FASTA');

    sequences.forEach(seq => {
      // Add to MicrobeTrace
      // this.common.addNode({ id: seq.id, _sequence: seq.sequence });
      console.log('[MAAGE Bridge] Would add node:', seq.id);
    });
  }

  /**
   * Parse FASTA format
   */
  private parseFasta(data: string): Array<{ id: string; sequence: string }> {
    const sequences: Array<{ id: string; sequence: string }> = [];
    const lines = data.split('\n');
    let currentId = '';
    let currentSeq = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        if (currentId) {
          sequences.push({ id: currentId, sequence: currentSeq });
        }
        currentId = trimmed.slice(1).split(/\s+/)[0];
        currentSeq = '';
      } else if (trimmed && currentId) {
        currentSeq += trimmed;
      }
    }

    if (currentId) {
      sequences.push({ id: currentId, sequence: currentSeq });
    }

    return sequences;
  }

  /**
   * Parse and load delimited data (CSV/TSV)
   */
  private loadDelimitedData(data: string, delimiter: string): void {
    const lines = data.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    console.log('[MAAGE Bridge] Parsed headers:', headers);

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseDelimitedLine(lines[i], delimiter);
      const node: Record<string, string> = {};

      headers.forEach((header, idx) => {
        node[header] = values[idx] || '';
      });

      if (!node.id) {
        node.id = node[headers[0]] || `node_${i}`;
      }

      // this.common.addNode(node);
      console.log('[MAAGE Bridge] Would add node:', node.id);
    }
  }

  /**
   * Parse a delimited line handling quoted values
   */
  private parseDelimitedLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Load Newick tree data
   */
  private loadNewickData(data: string): void {
    console.log('[MAAGE Bridge] Loading Newick tree');
    // this.common.loadNewick(data);
  }

  /**
   * Load MicrobeTrace session data
   */
  private loadSessionData(data: string): void {
    try {
      const session = JSON.parse(data);
      console.log('[MAAGE Bridge] Loading session data');
      // this.common.applySession(session);
    } catch (e) {
      console.error('[MAAGE Bridge] Invalid session JSON:', e);
      this.sendError('Invalid session file format');
    }
  }

  /**
   * Auto-detect file type and load
   */
  private autoDetectAndLoad(data: string, filename: string): void {
    const trimmed = data.trim();

    if (trimmed.startsWith('>')) {
      this.loadFastaData(data);
    } else if (trimmed.startsWith('(') || trimmed.startsWith(';')) {
      this.loadNewickData(data);
    } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      this.loadSessionData(data);
    } else if (trimmed.includes('\t')) {
      this.loadDelimitedData(data, '\t');
    } else if (trimmed.includes(',')) {
      this.loadDelimitedData(data, ',');
    } else {
      console.warn('[MAAGE Bridge] Could not auto-detect file type for:', filename);
    }
  }

  /**
   * Export session and send to parent frame
   */
  private sendSessionToParent(): void {
    // Get session from CommonService
    // const sessionData = this.common.exportSession();
    const sessionData = {}; // Placeholder

    console.log('[MAAGE Bridge] Sending session to parent');

    window.parent.postMessage({
      source: 'microbetrace',
      type: 'SAVE_SESSION',
      sessionData: sessionData
    }, '*');
  }

  /**
   * Send error message to parent
   */
  private sendError(message: string): void {
    if (this.isEmbedded) {
      window.parent.postMessage({
        source: 'microbetrace',
        type: 'ERROR',
        message: message
      }, '*');
    }
  }
}
