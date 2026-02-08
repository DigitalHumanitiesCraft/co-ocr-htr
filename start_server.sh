#!/bin/bash
# Start local dev server for coOCR/HTR
cd "$(dirname "$0")/docs" && npx serve -l 3000
