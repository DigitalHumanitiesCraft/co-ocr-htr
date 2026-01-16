/**
 * vibing/js/ui.js
 * General UI Logic & Validation
 */
import { appState } from './state.js';

export function initUI() {
    initValidation();
    initDialogs();
}

function initValidation() {
    appState.addEventListener('selectionChanged', (e) => {
        const valCard = document.querySelector(`.validation-card[data-line="${e.detail.line}"]`);
        if (valCard) {
            valCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Flash effect
            valCard.style.backgroundColor = 'var(--bg-tertiary)';
            setTimeout(() => {
                valCard.style.transition = 'background-color 0.2s';
                valCard.style.backgroundColor = '#30363d';
                setTimeout(() => valCard.style.backgroundColor = '', 300);
            }, 10);
        }
    });

    document.querySelectorAll('.validation-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('details-toggle')) return;
            const line = card.getAttribute('data-line');
            if (line) appState.setSelection(parseInt(line));
        });
    });
}

function initDialogs() {
    // Placeholder for real implementations in next steps
    window.alert = (msg) => console.log('Alert:', msg); // Override annoying alerts for dev
}
