/**
 * SVG layer on top of an OpenSeadragon viewer whose coordinate system is the
 * viewport (image width = 1). Replaces the svg-overlay plugin, which was loaded
 * unversioned from a CDN; the viewer only needs node() to draw line regions.
 * The transform follows the plugin's approach: translate to the viewport
 * origin in pixels, scale by container width times zoom, then rotate.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvgOverlay(viewer, OSD = globalThis.OpenSeadragon) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    viewer.canvas.appendChild(svg);

    const node = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(node);

    const resize = () => {
        const viewport = viewer.viewport;
        if (!viewport) return;
        const width = viewport.getContainerSize().x;
        const origin = viewport.pixelFromPoint(new OSD.Point(0, 0), true);
        const scale = width * viewport.getZoom(true);
        let scaleX = scale;
        let x = origin.x;
        if (viewport.getFlip?.()) {
            scaleX = -scale;
            x = width - origin.x;
        }
        node.setAttribute(
            'transform',
            `translate(${x},${origin.y}) scale(${scaleX},${scale}) rotate(${viewport.getRotation()})`
        );
    };

    for (const event of ['animation', 'open', 'rotate', 'flip', 'resize']) {
        viewer.addHandler(event, resize);
    }
    resize();

    return { node: () => node, resize };
}
