import js from '@eslint/js';
import globals from 'globals';

export default [
    // Base recommended rules for all JS files
    js.configs.recommended,

    // Source files: browser environment
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                OpenSeadragon: 'readonly',
                marked: 'readonly',
            },
        },
        rules: {
            'eqeqeq': ['error', 'always'],
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            'no-undef': 'error',
            'prefer-const': 'warn',
            'no-var': 'error',
            'no-debugger': 'error',
            'no-alert': 'warn',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-throw-literal': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'warn',
        },
    },

    // Test files: node + vitest environment
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                OpenSeadragon: 'readonly',
                marked: 'readonly',
            },
        },
        rules: {
            'eqeqeq': ['error', 'always'],
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            'no-undef': 'error',
            'prefer-const': 'warn',
            'no-var': 'error',
        },
    },

    // Ignore non-source files
    {
        ignores: ['node_modules/', 'config.local.js', 'sw.js'],
    },
];
