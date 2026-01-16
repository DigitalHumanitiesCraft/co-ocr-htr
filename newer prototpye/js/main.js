/**
 * vibing/js/main.js
 * Application Entry Point
 */
import { initViewer } from './viewer.js';
import { initEditor } from './editor.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    initViewer();
    initEditor();
    initUI();
    console.log('coOCR/HTR Application Initialized (Modular)');
});
