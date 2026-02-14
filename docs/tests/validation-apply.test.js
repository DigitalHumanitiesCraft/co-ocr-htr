import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/services/validation.js', () => ({
  validationEngine: {
    validate: vi.fn()
  }
}));

vi.mock('../js/services/llm.js', () => ({
  llmService: {
    hasApiKey: vi.fn(() => true)
  },
  ISSUE_TYPES: {
    spelling: {
      name: 'Spelling',
      color: 'warning',
      description: 'Spelling issue'
    }
  }
}));

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadValidationPrompt: vi.fn(() => ''),
    saveValidationPrompt: vi.fn()
  }
}));

vi.mock('../js/components/dialogs.js', () => ({
  dialogManager: {
    showToast: vi.fn()
  }
}));

vi.mock('../js/components/batch-progress.js', () => ({
  batchProgress: {
    show: vi.fn(),
    update: vi.fn(),
    showComplete: vi.fn()
  }
}));

vi.mock('../js/editor.js', () => ({
  applySuggestionAtLine: vi.fn()
}));

const state = {
  pages: [],
  currentPageIndex: 0,
  document: { dataUrl: 'data:image/jpeg;base64,abc' },
  image: { url: 'data:image/jpeg;base64,abc' },
  transcription: { raw: 'prima linea\nsecunda linea', segments: [] },
  validation: {
    status: 'complete',
    rules: [],
    llmJudge: null,
    summary: { totalIssues: 1 },
    customPrompt: ''
  }
};

vi.mock('../js/state.js', () => ({
  appState: {
    addEventListener: vi.fn(),
    getState: vi.fn(() => state),
    setSelection: vi.fn(),
    setValidationStatus: vi.fn(),
    setValidationResults: vi.fn(),
    startBatch: vi.fn(),
    updateBatchProgress: vi.fn(),
    completeBatch: vi.fn(),
    saveSessionNow: vi.fn(),
    data: { batch: { abortRequested: false } }
  }
}));

import { appState } from '../js/state.js';
import { applySuggestionAtLine } from '../js/editor.js';
import { dialogManager } from '../js/components/dialogs.js';

let validationPanel;

function setupDom() {
  document.body.innerHTML = `
    <button id="btnValidate"></button>
    <dialog id="validateDialog"></dialog>
    <button id="startValidation"></button>
    <input type="checkbox" id="checkMarkers" checked />
    <input type="checkbox" id="checkStats" checked />
    <input type="checkbox" id="checkArtifacts" checked />
    <input type="checkbox" id="enableLLM" checked />
    <textarea id="customValidationPrompt"></textarea>
    <div id="validationContent">
      <div id="validationEmptyState"><h4></h4><p></p></div>
      <div id="ruleBasedSection" hidden><div id="ruleBasedContent"></div></div>
      <div id="llmReviewSection" hidden><div id="llmReviewContent"></div></div>
    </div>
    <span id="validationBadge"></span>
  `;
}

describe('ValidationPanel LLM Apply', () => {
  beforeAll(async () => {
    setupDom();
    const mod = await import('../js/components/validation.js');
    validationPanel = mod.validationPanel;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();

    validationPanel._initialized = false;
    validationPanel.init();

    state.validation.llmJudge = {
      confidence: 'likely',
      reasoning: '',
      issues: [
        {
          line: 2,
          text: 'secunda',
          type: 'spelling',
          suggestion: 'secvnda',
          explanation: 'u/v normalization'
        }
      ]
    };

    validationPanel.render({
      rules: [],
      llmJudge: state.validation.llmJudge,
      summary: { totalIssues: 1 }
    });
  });

  it('applies one issue from button click and marks item as applied', () => {
    applySuggestionAtLine.mockReturnValue({
      status: 'applied',
      message: 'Applied suggestion at line 2.'
    });

    const applyBtn = document.querySelector('.issue-apply-btn');
    applyBtn.click();

    expect(applySuggestionAtLine).toHaveBeenCalledWith({
      line: 2,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });
    expect(appState.setSelection).toHaveBeenCalledWith(2);

    const issueEl = document.querySelector('.validation-issue');
    expect(issueEl.classList.contains('applied')).toBe(true);
    expect(dialogManager.showToast).toHaveBeenCalledWith('Applied suggestion at line 2.', 'success');
  });

  it('marks issue as ambiguous and shows warning toast', () => {
    applySuggestionAtLine.mockReturnValue({
      status: 'ambiguous',
      message: 'Source text not found in the target line.'
    });

    validationPanel.applyIssueCorrection(0);

    const issueEl = document.querySelector('.validation-issue');
    expect(issueEl.classList.contains('ambiguous')).toBe(true);
    expect(dialogManager.showToast).toHaveBeenCalledWith('Source text not found in the target line.', 'warning');
  });

  it('uses remapped line from apply result for selection highlighting', () => {
    applySuggestionAtLine.mockReturnValue({
      status: 'applied',
      line: 5,
      message: 'Applied suggestion at line 5 (requested line 2).'
    });

    validationPanel.applyIssueCorrection(0);

    expect(appState.setSelection).toHaveBeenCalledWith(5);
  });

  it('treats multiline suggestions as manual-only in single issue apply', () => {
    state.validation.llmJudge = {
      confidence: 'likely',
      reasoning: '',
      issues: [
        {
          line: 2,
          text: 'secunda',
          type: 'spelling',
          suggestion: 'secunda\nlinea',
          explanation: 'Line break required'
        }
      ]
    };

    validationPanel.render({
      rules: [],
      llmJudge: state.validation.llmJudge,
      summary: { totalIssues: 1 }
    });

    expect(document.querySelector('.issue-apply-btn')).toBeNull();
    expect(document.querySelector('.issue-manual-note')?.textContent).toContain('Multiline suggestion');

    const result = validationPanel.applyIssueCorrection(0);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Apply manually');
    expect(applySuggestionAtLine).not.toHaveBeenCalled();
  });

  it('returns failed for invalid issue index', () => {
    const result = validationPanel.applyIssueCorrection(9, { silent: true });

    expect(result.status).toBe('failed');
    expect(result.message).toBe('Issue not found.');
  });

  it('apply all uses descending line order and skips multiline suggestions', () => {
    applySuggestionAtLine.mockReturnValue({
      status: 'applied',
      message: 'Applied.'
    });

    state.validation.llmJudge = {
      confidence: 'likely',
      reasoning: '',
      issues: [
        { line: 1, text: 'prima', type: 'spelling', suggestion: 'primae', explanation: '' },
        { line: 3, text: 'tertia', type: 'spelling', suggestion: 'tercia', explanation: '' },
        { line: 2, text: 'secunda', type: 'spelling', suggestion: 'linea\nsecvnda', explanation: '' }
      ]
    };

    validationPanel.render({
      rules: [],
      llmJudge: state.validation.llmJudge,
      summary: { totalIssues: 3 }
    });

    validationPanel.applyAllIssueCorrections();

    expect(applySuggestionAtLine).toHaveBeenCalledTimes(2);
    expect(applySuggestionAtLine.mock.calls[0][0].line).toBe(3);
    expect(applySuggestionAtLine.mock.calls[1][0].line).toBe(1);

    const skippedIssue = document.querySelector('.validation-issue[data-issue-index="2"]');
    expect(skippedIssue.classList.contains('failed')).toBe(true);
    expect(dialogManager.showToast).toHaveBeenCalledWith(
      expect.stringContaining('multiline skipped'),
      'warning'
    );
  });
});
