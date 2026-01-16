/**
 * METS-XML Parser
 *
 * Parses METS (Metadata Encoding and Transmission Standard) XML files
 * to extract document structure, page information, and image references.
 */

class MetsXMLParser {
    constructor() {
        this.nsResolver = (prefix) => {
            const namespaces = {
                'mets': 'http://www.loc.gov/METS/',
                'mods': 'http://www.loc.gov/mods/v3',
                'xlink': 'http://www.w3.org/1999/xlink',
                'dv': 'http://dfg-viewer.de/',
                'exif': 'http://ns.adobe.com/exif/1.0/'
            };
            return namespaces[prefix] || null;
        };
    }

    /**
     * Parse METS-XML content
     * @param {string} xmlContent - METS-XML as string
     * @param {string} baseUrl - Base URL for resolving relative paths
     * @returns {object} Parsed METS data
     */
    parse(xmlContent, baseUrl = '') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'application/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error(`METS-XML Parse Error: ${parseError.textContent}`);
        }

        return {
            metadata: this._extractMetadata(doc),
            files: this._extractFiles(doc, baseUrl),
            pages: this._extractPages(doc, baseUrl),
            structure: this._extractStructure(doc)
        };
    }

    /**
     * Extract descriptive metadata from dmdSec
     */
    _extractMetadata(doc) {
        const metadata = {
            title: '',
            author: '',
            language: '',
            date: '',
            identifier: '',
            rights: ''
        };

        // Try MODS namespace
        const titleEl = doc.querySelector('titleInfo title, mods\\:title');
        if (titleEl) metadata.title = titleEl.textContent.trim();

        const authorEl = doc.querySelector('name displayForm, mods\\:displayForm');
        if (authorEl) metadata.author = authorEl.textContent.trim();

        const langEl = doc.querySelector('language languageTerm[type="text"], mods\\:languageTerm[type="text"]');
        if (langEl) metadata.language = langEl.textContent.trim();

        const dateEl = doc.querySelector('dateIssued, mods\\:dateIssued');
        if (dateEl) metadata.date = dateEl.textContent.trim();

        const idEl = doc.querySelector('identifier[type="urn"], mods\\:identifier[type="urn"]');
        if (idEl) metadata.identifier = idEl.textContent.trim();

        const rightsEl = doc.querySelector('owner, dv\\:owner');
        if (rightsEl) metadata.rights = rightsEl.textContent.trim();

        return metadata;
    }

    /**
     * Extract file information from fileSec
     */
    _extractFiles(doc, baseUrl) {
        const files = {};

        // Get all file elements
        const fileEls = doc.querySelectorAll('file, mets\\:file');

        fileEls.forEach(fileEl => {
            const id = fileEl.getAttribute('ID');
            const mimeType = fileEl.getAttribute('MIMETYPE') || 'image/jpeg';

            // Get file location
            const flocatEl = fileEl.querySelector('FLocat, mets\\:FLocat');
            let href = '';

            if (flocatEl) {
                href = flocatEl.getAttribute('xlink:href') ||
                       flocatEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
                       flocatEl.getAttribute('href');
            }

            // Get dimensions if available
            let width = 0, height = 0;
            const widthEl = fileEl.querySelector('PixelXDimension, exif\\:PixelXDimension');
            const heightEl = fileEl.querySelector('PixelYDimension, exif\\:PixelYDimension');
            if (widthEl) width = parseInt(widthEl.textContent) || 0;
            if (heightEl) height = parseInt(heightEl.textContent) || 0;

            // Determine file use (DEFAULT = full image, THUMBS = thumbnail)
            const fileGrp = fileEl.closest('fileGrp, mets\\:fileGrp');
            const use = fileGrp?.getAttribute('USE') || 'DEFAULT';

            files[id] = {
                id,
                href: this._resolveUrl(href, baseUrl),
                mimeType,
                width,
                height,
                use
            };
        });

        return files;
    }

    /**
     * Extract page information from structMap PHYSICAL
     */
    _extractPages(doc, baseUrl) {
        const pages = [];
        const files = this._extractFiles(doc, baseUrl);

        // Find physical structMap
        const physStructMap = doc.querySelector('structMap[TYPE="PHYSICAL"], mets\\:structMap[TYPE="PHYSICAL"]');
        if (!physStructMap) {
            console.warn('[METS] No physical structMap found');
            return pages;
        }

        // Get page divs
        const pageDivs = physStructMap.querySelectorAll('div[TYPE="page"], mets\\:div[TYPE="page"]');

        pageDivs.forEach((pageDiv, index) => {
            const order = parseInt(pageDiv.getAttribute('ORDER')) || (index + 1);
            const id = pageDiv.getAttribute('ID') || `page-${order}`;
            const contentIds = pageDiv.getAttribute('CONTENTIDS') || '';

            // Get file pointers
            const fptrs = pageDiv.querySelectorAll('fptr, mets\\:fptr');
            let imageFile = null;
            let thumbFile = null;

            fptrs.forEach(fptr => {
                const fileId = fptr.getAttribute('FILEID');
                const file = files[fileId];
                if (file) {
                    if (file.use === 'DEFAULT' || file.use === 'MASTER') {
                        imageFile = file;
                    } else if (file.use === 'THUMBS' || file.use === 'THUMBNAIL') {
                        thumbFile = file;
                    }
                }
            });

            if (imageFile) {
                pages.push({
                    id,
                    order,
                    contentIds,
                    image: imageFile.href,
                    thumbnail: thumbFile?.href || imageFile.href,
                    width: imageFile.width,
                    height: imageFile.height,
                    mimeType: imageFile.mimeType
                });
            }
        });

        // Sort by order
        pages.sort((a, b) => a.order - b.order);

        return pages;
    }

    /**
     * Extract logical structure from structMap LOGICAL
     */
    _extractStructure(doc) {
        const structure = [];

        const logStructMap = doc.querySelector('structMap[TYPE="LOGICAL"], mets\\:structMap[TYPE="LOGICAL"]');
        if (!logStructMap) return structure;

        const parseDiv = (divEl, level = 0) => {
            const type = divEl.getAttribute('TYPE') || '';
            const id = divEl.getAttribute('ID') || '';
            const label = divEl.getAttribute('LABEL') || type;

            const item = { id, type, label, level, children: [] };

            // Get child divs
            const childDivs = divEl.querySelectorAll(':scope > div, :scope > mets\\:div');
            childDivs.forEach(childDiv => {
                item.children.push(parseDiv(childDiv, level + 1));
            });

            return item;
        };

        const topDivs = logStructMap.querySelectorAll(':scope > div, :scope > mets\\:div');
        topDivs.forEach(div => {
            structure.push(parseDiv(div));
        });

        return structure;
    }

    /**
     * Resolve relative URLs
     */
    _resolveUrl(url, baseUrl) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        if (baseUrl) {
            return new URL(url, baseUrl).href;
        }
        return url;
    }

    /**
     * Quick check if content is METS-XML
     */
    isMetsXML(content) {
        return content.includes('<mets:mets') ||
               content.includes('<mets ') ||
               content.includes('xmlns:mets="http://www.loc.gov/METS/"');
    }
}

// Export singleton
export const metsXMLParser = new MetsXMLParser();
