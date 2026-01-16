/**
 * Samples Service
 *
 * Loads demo samples from the samples/ directory
 * Supports single-page and multi-page documents
 */

import { appState } from '../state.js';
import { pageXMLParser } from './parsers/page-xml.js';
import { metsXMLParser } from './parsers/mets-xml.js';

const SAMPLES_BASE = 'samples/';

/**
 * Sample Loader Service
 */
class SamplesService {
    constructor() {
        this.manifest = null;
        this.loaded = false;
    }

    /**
     * Load the samples manifest
     */
    async loadManifest() {
        if (this.manifest) return this.manifest;

        try {
            const response = await fetch(`${SAMPLES_BASE}index.json`);
            if (!response.ok) {
                throw new Error(`Failed to load samples manifest: ${response.status}`);
            }
            this.manifest = await response.json();
            this.loaded = true;
            return this.manifest;
        } catch (error) {
            console.error('Failed to load samples manifest:', error);
            return { samples: [] };
        }
    }

    /**
     * Get list of available samples
     */
    async getSamples() {
        const manifest = await this.loadManifest();
        return manifest.samples || [];
    }

    /**
     * Load a specific sample by ID
     */
    async loadSample(sampleId) {
        const manifest = await this.loadManifest();
        const sample = manifest.samples?.find(s => s.id === sampleId);

        if (!sample) {
            throw new Error(`Sample not found: ${sampleId}`);
        }

        // Check if multi-page sample
        if (sample.pages && sample.pages.length > 0) {
            return this.loadMultiPageSample(sample);
        }

        // Single-page sample
        return this.loadSinglePageSample(sample);
    }

    /**
     * Load a single-page sample
     */
    async loadSinglePageSample(sample) {
        // Load image
        const imageUrl = `${SAMPLES_BASE}${sample.image}`;
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to load sample image: ${imageResponse.status}`);
        }

        const imageBlob = await imageResponse.blob();
        const dataUrl = await this.blobToDataUrl(imageBlob);

        // Create a pseudo-file object
        const file = new File([imageBlob], sample.image.split('/').pop(), {
            type: imageBlob.type
        });

        // Get image dimensions
        const dimensions = await this.getImageDimensions(dataUrl);

        // Set document state
        appState.setDocument(file, dataUrl);
        appState.setImageDimensions(dimensions.width, dimensions.height);

        // Load PAGE-XML if available
        if (sample.pageXml) {
            try {
                const xmlUrl = `${SAMPLES_BASE}${sample.pageXml}`;
                const xmlResponse = await fetch(xmlUrl);
                if (xmlResponse.ok) {
                    const xmlContent = await xmlResponse.text();
                    const parsed = pageXMLParser.parse(xmlContent);

                    if (parsed.segments?.length > 0) {
                        appState.setTranscription({
                            segments: parsed.segments,
                            columns: parsed.columns || [],
                            provider: 'PAGE-XML Import',
                            model: 'Transkribus'
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to load PAGE-XML:', error);
            }
        }

        return sample;
    }

    /**
     * Load a multi-page sample
     */
    async loadMultiPageSample(sample) {
        console.log(`[Samples] Loading multi-page sample: ${sample.id} (${sample.pages.length} pages)`);

        const pages = [];

        for (let i = 0; i < sample.pages.length; i++) {
            const pageDef = sample.pages[i];
            const imageUrl = `${SAMPLES_BASE}${pageDef.image}`;

            try {
                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) {
                    console.warn(`Failed to load page ${i + 1}: ${imageResponse.status}`);
                    continue;
                }

                const imageBlob = await imageResponse.blob();
                const dataUrl = await this.blobToDataUrl(imageBlob);
                const dimensions = await this.getImageDimensions(dataUrl);

                const page = {
                    id: pageDef.id || `page-${i + 1}`,
                    filename: pageDef.image.split('/').pop(),
                    dataUrl: dataUrl,
                    width: dimensions.width,
                    height: dimensions.height,
                    pageXml: pageDef.pageXml || null,
                    order: i + 1
                };

                // Load PAGE-XML for this page if available
                if (pageDef.pageXml) {
                    try {
                        const xmlUrl = `${SAMPLES_BASE}${pageDef.pageXml}`;
                        const xmlResponse = await fetch(xmlUrl);
                        if (xmlResponse.ok) {
                            page.pageXmlContent = await xmlResponse.text();
                        }
                    } catch (error) {
                        console.warn(`Failed to load PAGE-XML for page ${i + 1}:`, error);
                    }
                }

                pages.push(page);
            } catch (error) {
                console.warn(`Failed to load page ${i + 1}:`, error);
            }
        }

        if (pages.length === 0) {
            throw new Error('No pages could be loaded');
        }

        // Set pages in state
        appState.setPages(pages);

        // Load transcription for first page if PAGE-XML available
        const firstPage = pages[0];
        if (firstPage.pageXmlContent) {
            try {
                const parsed = pageXMLParser.parse(firstPage.pageXmlContent);
                if (parsed.segments?.length > 0) {
                    appState.setTranscription({
                        segments: parsed.segments,
                        columns: parsed.columns || [],
                        provider: 'PAGE-XML Import',
                        model: 'Transkribus'
                    });
                }
            } catch (error) {
                console.warn('Failed to parse PAGE-XML for first page:', error);
            }
        }

        return sample;
    }

    /**
     * Convert blob to data URL
     */
    blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Get image dimensions
     */
    getImageDimensions(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = () => {
                resolve({ width: 1000, height: 1000 });
            };
            img.src = dataUrl;
        });
    }
}

// Export singleton
export const samplesService = new SamplesService();
