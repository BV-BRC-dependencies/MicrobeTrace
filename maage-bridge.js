/**
 * MAAGE Bridge Service for MicrobeTrace
 *
 * This service enables bidirectional communication between MicrobeTrace (when embedded
 * in an iframe) and the MAAGE-Web platform. It handles:
 *
 * 1. Loading data files from MAAGE workspace URLs
 * 2. Sending session data back to MAAGE for saving
 * 3. Notifying MAAGE when MicrobeTrace is ready
 *
 * Installation:
 * This file should be added to MicrobeTrace's source code and initialized
 * when the application starts. For Angular apps, create a service that
 * imports and initializes this bridge.
 *
 * Usage in MicrobeTrace Angular app:
 * 1. Add this file to src/app/services/maage-bridge.service.ts
 * 2. Import and inject in app.module.ts
 * 3. Initialize in app.component.ts constructor
 *
 * @see https://github.com/CDCgov/MicrobeTrace/wiki/zForDevelopers-%E2%80%93-Assimilating-MicrobeTrace
 */

(function (global) {
  'use strict';

  /**
   * MAAGE Bridge - Handles communication with parent MAAGE-Web frame
   */
  var MaageBridge = {
    isEmbedded: false,
    isReady: false,
    commonService: null, // Reference to MicrobeTrace's CommonService

    /**
     * Initialize the bridge
     * @param {Object} commonService - MicrobeTrace's CommonService instance
     */
    init: function (commonService) {
      this.commonService = commonService;
      this.detectEmbedding();
      this.initMessageListener();

      console.log('[MAAGE Bridge] Initialized, embedded:', this.isEmbedded);
    },

    /**
     * Check if running inside an iframe (embedded in MAAGE)
     */
    detectEmbedding: function () {
      try {
        this.isEmbedded = window.self !== window.top;
      } catch (e) {
        // If we can't access window.top due to same-origin policy, assume embedded
        this.isEmbedded = true;
      }
    },

    /**
     * Set up message event listener for postMessage communication
     */
    initMessageListener: function () {
      var self = this;

      window.addEventListener('message', function (event) {
        // Only process messages from MAAGE parent
        if (!event.data || event.data.source !== 'maage') {
          return;
        }

        console.log('[MAAGE Bridge] Received message:', event.data.type);

        switch (event.data.type) {
          case 'LOAD_DATA':
            self.loadDataFromUrl(
              event.data.url,
              event.data.fileType,
              event.data.filename
            );
            break;

          case 'REQUEST_SAVE':
            self.sendSessionToParent();
            break;

          default:
            console.warn('[MAAGE Bridge] Unknown message type:', event.data.type);
        }
      });

      // Notify parent that MicrobeTrace is ready
      if (this.isEmbedded) {
        this.notifyReady();
      }
    },

    /**
     * Notify parent frame that MicrobeTrace is ready to receive data
     */
    notifyReady: function () {
      this.isReady = true;
      window.parent.postMessage({
        source: 'microbetrace',
        type: 'READY'
      }, '*');

      console.log('[MAAGE Bridge] Sent READY notification to parent');
    },

    /**
     * Load data from a URL (workspace file)
     * @param {string} url - The URL to fetch data from
     * @param {string} fileType - The file extension/type
     * @param {string} filename - The original filename
     */
    loadDataFromUrl: function (url, fileType, filename) {
      var self = this;

      console.log('[MAAGE Bridge] Loading data:', filename, 'type:', fileType);

      fetch(url, {
        credentials: 'include' // Include cookies for authenticated requests
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
          }
          return response.text();
        })
        .then(function (data) {
          self.processData(data, fileType, filename);
        })
        .catch(function (error) {
          console.error('[MAAGE Bridge] Error loading data:', error);
          self.sendError('Failed to load data: ' + error.message);
        });
    },

    /**
     * Process loaded data based on file type
     * @param {string} data - The file contents
     * @param {string} fileType - The file extension/type
     * @param {string} filename - The original filename
     */
    processData: function (data, fileType, filename) {
      var self = this;

      try {
        // Clear existing data if CommonService is available
        if (this.commonService && typeof this.commonService.reset === 'function') {
          this.commonService.reset();
        }

        // Parse based on file type
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
            // Try to auto-detect based on content
            this.autoDetectAndLoad(data, filename);
        }

        console.log('[MAAGE Bridge] Data loaded successfully');

        // Trigger MicrobeTrace to refresh/update visualization
        if (this.commonService && typeof this.commonService.updateVisualization === 'function') {
          this.commonService.updateVisualization();
        }

      } catch (error) {
        console.error('[MAAGE Bridge] Error processing data:', error);
        this.sendError('Failed to process data: ' + error.message);
      }
    },

    /**
     * Parse and load FASTA format data
     * @param {string} data - FASTA formatted string
     */
    loadFastaData: function (data) {
      var sequences = this.parseFasta(data);

      console.log('[MAAGE Bridge] Parsed', sequences.length, 'sequences from FASTA');

      // Add nodes to MicrobeTrace
      if (this.commonService) {
        sequences.forEach(function (seq) {
          // MicrobeTrace CommonService API
          if (typeof this.commonService.addNode === 'function') {
            this.commonService.addNode({
              id: seq.id,
              _sequence: seq.sequence
            });
          }
        }, this);
      }
    },

    /**
     * Parse FASTA format
     * @param {string} data - FASTA formatted string
     * @returns {Array} Array of {id, sequence} objects
     */
    parseFasta: function (data) {
      var sequences = [];
      var lines = data.split('\n');
      var currentId = '';
      var currentSeq = '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        if (line.startsWith('>')) {
          // Save previous sequence
          if (currentId) {
            sequences.push({ id: currentId, sequence: currentSeq });
          }
          // Start new sequence - take ID as first word after >
          currentId = line.slice(1).split(/\s+/)[0];
          currentSeq = '';
        } else if (line && currentId) {
          // Append to current sequence
          currentSeq += line;
        }
      }

      // Don't forget the last sequence
      if (currentId) {
        sequences.push({ id: currentId, sequence: currentSeq });
      }

      return sequences;
    },

    /**
     * Parse and load delimited data (CSV/TSV)
     * @param {string} data - Delimited data string
     * @param {string} delimiter - The delimiter character
     */
    loadDelimitedData: function (data, delimiter) {
      var lines = data.trim().split('\n');
      if (lines.length < 2) {
        console.warn('[MAAGE Bridge] Delimited file has no data rows');
        return;
      }

      var headers = lines[0].split(delimiter).map(function (h) {
        return h.trim().replace(/^"|"$/g, ''); // Remove quotes
      });

      console.log('[MAAGE Bridge] Parsed headers:', headers);

      // Add nodes from data rows
      for (var i = 1; i < lines.length; i++) {
        var values = this.parseDelimitedLine(lines[i], delimiter);
        var node = {};

        headers.forEach(function (header, idx) {
          node[header] = values[idx] || '';
        });

        // Ensure node has an id
        if (!node.id) {
          node.id = node[headers[0]] || 'node_' + i;
        }

        if (this.commonService && typeof this.commonService.addNode === 'function') {
          this.commonService.addNode(node);
        }
      }
    },

    /**
     * Parse a single delimited line, handling quoted values
     * @param {string} line - The line to parse
     * @param {string} delimiter - The delimiter character
     * @returns {Array} Array of values
     */
    parseDelimitedLine: function (line, delimiter) {
      var values = [];
      var current = '';
      var inQuotes = false;

      for (var i = 0; i < line.length; i++) {
        var char = line[i];

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
    },

    /**
     * Parse and load Newick tree data
     * @param {string} data - Newick formatted string
     */
    loadNewickData: function (data) {
      console.log('[MAAGE Bridge] Loading Newick tree');

      // MicrobeTrace has built-in Newick parsing
      if (this.commonService && typeof this.commonService.loadNewick === 'function') {
        this.commonService.loadNewick(data);
      } else {
        // Fallback: extract node names from Newick string
        var nodeNames = this.extractNewickNodes(data);
        console.log('[MAAGE Bridge] Extracted', nodeNames.length, 'nodes from Newick');

        nodeNames.forEach(function (name) {
          if (this.commonService && typeof this.commonService.addNode === 'function') {
            this.commonService.addNode({ id: name });
          }
        }, this);
      }
    },

    /**
     * Extract node names from Newick string
     * @param {string} newick - Newick formatted string
     * @returns {Array} Array of node names
     */
    extractNewickNodes: function (newick) {
      // Simple extraction - matches names before : or ) or ,
      var regex = /([A-Za-z0-9_.-]+)(?=[,:)])/g;
      var names = [];
      var match;

      while ((match = regex.exec(newick)) !== null) {
        var name = match[1];
        // Filter out numeric-only matches (branch lengths)
        if (!/^\d+\.?\d*$/.test(name)) {
          names.push(name);
        }
      }

      return names;
    },

    /**
     * Load a MicrobeTrace session file
     * @param {string} data - JSON session data
     */
    loadSessionData: function (data) {
      try {
        var session = typeof data === 'string' ? JSON.parse(data) : data;

        console.log('[MAAGE Bridge] Loading session data');

        // MicrobeTrace session loading
        if (this.commonService && typeof this.commonService.applySession === 'function') {
          this.commonService.applySession(session);
        } else if (this.commonService && typeof this.commonService.loadSession === 'function') {
          this.commonService.loadSession(session);
        } else {
          console.warn('[MAAGE Bridge] No session loading method available in CommonService');
        }

      } catch (e) {
        console.error('[MAAGE Bridge] Invalid session JSON:', e);
        this.sendError('Invalid session file format');
      }
    },

    /**
     * Auto-detect file type and load
     * @param {string} data - File contents
     * @param {string} filename - Original filename
     */
    autoDetectAndLoad: function (data, filename) {
      var trimmed = data.trim();

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
    },

    /**
     * Export current session and send to parent frame
     */
    sendSessionToParent: function () {
      var sessionData;

      // Try to export session from CommonService
      if (this.commonService) {
        if (typeof this.commonService.exportSession === 'function') {
          sessionData = this.commonService.exportSession();
        } else if (typeof this.commonService.getSession === 'function') {
          sessionData = this.commonService.getSession();
        } else if (typeof this.commonService.session === 'object') {
          sessionData = this.commonService.session;
        }
      }

      if (!sessionData) {
        console.warn('[MAAGE Bridge] No session data available to export');
        this.sendError('No session data available');
        return;
      }

      console.log('[MAAGE Bridge] Sending session to parent');

      window.parent.postMessage({
        source: 'microbetrace',
        type: 'SAVE_SESSION',
        sessionData: sessionData
      }, '*');
    },

    /**
     * Send error message to parent frame
     * @param {string} message - Error message
     */
    sendError: function (message) {
      if (this.isEmbedded) {
        window.parent.postMessage({
          source: 'microbetrace',
          type: 'ERROR',
          message: message
        }, '*');
      }
    }
  };

  // Expose globally for use in MicrobeTrace
  global.MaageBridge = MaageBridge;

  // Auto-initialize if not in module context
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      // Wait for MicrobeTrace to initialize, then connect the bridge
      // The actual initialization with CommonService should be done by MicrobeTrace
      setTimeout(function () {
        if (!MaageBridge.isReady && MaageBridge.isEmbedded) {
          // Initialize without CommonService - basic functionality
          MaageBridge.init(null);
        }
      }, 1000);
    });
  }

})(typeof window !== 'undefined' ? window : this);
