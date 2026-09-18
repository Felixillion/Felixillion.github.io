// .ulviewer load
let loadedZip = null;

// Metadata
let metadata = null;
let metadataFileHandle = null;

// H&E
let heOpacity = 1.0;

// Segmentation data
let segmentationData = [];
let segmentationVisible = true;
let segmentationColor = "#00ffff";
let segmentationThickness = 0.5;
let segmentationOpacity = 1.0;
let cellSelectionEnabled = false;

// Genes
let geneLayers = {};

let overlayCanvas = null;
let overlayCtx = null;

let datasetRoot = "";

// Proteins
let proteinLayers = {};
let proteinOpacity = 0.8;
let proteinCanvas = null;

// Cell info
let selectedCell = null;
let hoveredCell = null;
let activeGene = null;

// Visibility states (to do with screenshot)
let showGenes = true;
let showProteins = true;
let showSegs = true;
let showHELayer = true;
let showScaleBar = true;


// Dropzone for dragging file
const dropZone =
    document.getElementById(
        "dropZone"
    );

// Screenshot
const saveScreenshotBtn =
    document.getElementById(
        "saveScreenshotBtn"
    );

// Export sections
const exportHE =
    document.getElementById(
        "exportHE"
    );

const exportGenes =
    document.getElementById(
        "exportGenes"
    );

const exportProteins =
    document.getElementById(
        "exportProteins"
    );

const exportSegs =
    document.getElementById(
        "exportSegs"
    );

const exportScaleBar =
    document.getElementById(
        "exportScaleBar"
    );

const exportCellInfo =
    document.getElementById(
        "exportCellInfo"
    );

// H&E opacity
const heOpacitySlider =
    document.getElementById(
        "heOpacity"
    );

// Default protein colours
const DEFAULT_PROTEIN_COLORS = [
    "#00ff00", // green
    "#ff0000", // red
    "#00ffff", // cyan
    "#ffff00", // yellow
    "#ff00ff", // magenta
    "#ffffff"  // white
];

// Default gene colours
const DEFAULT_GENE_COLORS = [
    "#ff00ff",
    "#00ffff",
    "#ffff00",
    "#ff8800",
    "#ffffff"
];

const infoBox =
    document.getElementById(
        "info"
    );

// Populate gene dropdown
const geneList =
    document.getElementById(
        "geneList"
    );

// Gene search
const geneSearch =
    document.getElementById(
        "geneSearch"
    );    

// Proteins
const proteinList =
    document.getElementById(
        "proteinList"
    );

const proteinSearch =
    document.getElementById(
        "proteinSearch"
    );

const proteinOpacitySlider =
    document.getElementById(
        "proteinOpacity"
    );

const loadedProteinsDiv =
    document.getElementById(
        "loadedProteins"
    );

const loadedGenesDiv =
    document.getElementById(
        "loadedGenes"
    );

// Cell info
const cellInfo =
    document.getElementById(
        "cellInfoPanel"
    );

// Cell info selection
const enableCellSelection =
    document.getElementById(
        "enableCellSelection"
    );

// Update button text
const btn =
    document.getElementById(
        "toggleLayersBtn"
    );


let allGenes = [];
let allProteins = [];

let viewer = null;
let heImage = null;


// Load data
async function loadUlviewer(file) {
    loadedZip =
        await JSZip.loadAsync(
            file
        );

    datasetRoot = "";

    const metadataText =
        await loadedZip
            .file("metadata.json")
            .async("string");

    metadata =
        JSON.parse(
            metadataText
        );

    await initialiseDataset();

    // Mobile-specific conditions
    if (
        window.innerWidth <= 768
    ) {

        showMobileTopSection(
            "displaySection"
        );
    }
}


async function initialiseDataset() {
    geneList.innerHTML = "";
    proteinList.innerHTML = "";

    allGenes =
        Object.keys(
            metadata.genes
        ).sort();

    allProteins =
        Object.keys(
            metadata.proteins
        ).sort();

    renderGeneList();

    renderProteinList();

    infoBox.textContent =
        `Core: ${metadata.core}
        Version: ${metadata.export_version}
        Genes: ${Object.keys(metadata.genes).length}
        Proteins: ${Object.keys(metadata.proteins).length}
        Segmentations: ${Object.keys(metadata.segmentations).length}`;

    const heBlob =
        await getBlob(
            metadata.image.file
        );

    const imageURL =
        URL.createObjectURL(
            heBlob
        );

    heImage =
        new Image();

    heImage.src =
        imageURL;

    if (viewer) {
        viewer.destroy();
    }

    viewer =
        OpenSeadragon({

            id: "viewer",

            prefixUrl:
                "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/",

            tileSources: {
                type: "image",
                url: imageURL
            }
        });

    viewer.addHandler(
        "open",
        setupOverlay
    );

    document
        .getElementById(
            "mobileDisplayTab"
        )
        .style.display = "block";

    document
        .getElementById(
            "mobileScreenshotTab"
        )
        .style.display = "block";
}


// Blob loader
async function getBlob(path) {

    if (loadedZip) {

        return await loadedZip
            .file(path)
            .async("blob");
    }

    const response =
        await fetch(
            `${datasetRoot}/${path}`
        );

    return await response.blob();
}


// Gzip loader
async function getCompressedFile(path) {

    if (loadedZip) {

        return await loadedZip
            .file(path)
            .async(
                "uint8array"
            );
    }

    const response =
        await fetch(
            `${datasetRoot}/${path}`
        );

    return new Uint8Array(
        await response.arrayBuffer()
    );
}


function setupOverlay() {

    const container =
        viewer.canvas;

    overlayCanvas =
        document.createElement(
            "canvas"
        );

    overlayCanvas.className =
        "overlay-canvas";

    container.appendChild(
        overlayCanvas
    );

    overlayCtx =
        overlayCanvas.getContext(
            "2d",
            {
                willReadFrequently: true,
            }
        );

    resizeOverlayCanvas();
    updateOverlay();

    viewer.addHandler(
        "viewport-change",
        updateOverlay
    );

    viewer.addHandler(
        "resize",
        () => {
            resizeOverlayCanvas();
            updateOverlay();
        }
    );

    // Cell info
    viewer.addHandler(
        "canvas-click",
        onViewerClick
    );

    // Mouse tracking
    viewer.container.addEventListener(
        "mousemove",
        onViewerMove
    );
}


function clearCanvas() {

    if (!overlayCanvas) {
        return;
    }

    overlayCtx.clearRect(
        0,
        0,
        overlayCanvas.width,
        overlayCanvas.height
    );
}


function resizeOverlayCanvas() {
    const rect =
        viewer.canvas.getBoundingClientRect();

    overlayCanvas.width =
        rect.width;

    overlayCanvas.height =
        rect.height;
}


// Save screenshot
function saveScreenshot() {

    if (!heImage) {
        return;
    }

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        overlayCanvas.width;

    canvas.height =
        overlayCanvas.height;

    const exportCtx =
        canvas.getContext(
            "2d"
        );

    // Black background
    exportCtx.fillStyle =
        "black";

    exportCtx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // H&E with current opacity
    if (
        exportHE.checked
    ) {

        exportCtx.globalAlpha =
            heOpacity;

        exportCtx.drawImage(
            viewer.drawer.canvas,
            0,
            0,
            canvas.width,
            canvas.height
        );

        exportCtx.globalAlpha =
            1;
    }

    // Overlay
    if (
        exportProteins.checked
    ) {

        drawProteinsToContext(
            exportCtx
        );
    }

    if (
        exportSegs.checked
    ) {

        drawSegmentationsToContext(
            exportCtx
        );
    }

    if (
        exportGenes.checked
    ) {

        drawGenesToContext(
            exportCtx
        );
    }

    // Scale bar
    if (
        exportScaleBar.checked
    ) {

        drawScaleBar(
            exportCtx
        );
    }

    const link =
        document.createElement(
            "a"
        );

    link.download =
        "ulviewer_screenshot.png";

    link.href =
        canvas.toDataURL(
            "image/png"
        );

    link.click();
}


// Screenshot genes
function drawGenesToContext(targetCtx) {

    for (
        const geneName
        in geneLayers
    ) {

        const layer =
            geneLayers[
                geneName
            ];

        targetCtx.fillStyle =
            layer.color;

        for (
            const pt
            of layer.points
        ) {

            const vp =
                viewer.viewport.imageToViewerElementCoordinates(
                    new OpenSeadragon.Point(
                        pt.x,
                        pt.y
                    )
                );

            targetCtx.beginPath();

            targetCtx.arc(
                vp.x,
                vp.y,
                layer.size,
                0,
                2 * Math.PI
            );

            targetCtx.fill();
        }
    }
}


// Screenshot segmentations
function drawSegmentationsToContext(targetCtx) {

    for (
        const cell
        of segmentationData
    ) {

        // Don't screenshot selected cell
        const isSelected =
            false;
        // Don't screenshot hovered cell
        const isHovered =
            false;

        targetCtx.strokeStyle =
            hexToRgba(
                segmentationColor,
                segmentationOpacity
            );

        targetCtx.lineWidth =
            segmentationThickness;

        targetCtx.beginPath();

        cell.vertices.forEach(
            (pt, idx) => {

                const vp =
                    viewer.viewport.imageToViewerElementCoordinates(
                        new OpenSeadragon.Point(
                            pt[0],
                            pt[1]
                        )
                    );

                if (
                    idx === 0
                ) {

                    targetCtx.moveTo(
                        vp.x,
                        vp.y
                    );

                } else {

                    targetCtx.lineTo(
                        vp.x,
                        vp.y
                    );
                }
            }
        );

        targetCtx.closePath();

        targetCtx.stroke();
    }
}


// Screenshot proteins
function drawProteinsToContext(targetCtx) {

    for (
        const marker
        in proteinLayers
    ) {

        const layer =
            proteinLayers[marker];

        if (!layer.cachedCanvas) {
            continue;
        }

        const topLeft =
            viewer.viewport.imageToViewerElementCoordinates(
                new OpenSeadragon.Point(
                    0,
                    0
                )
            );

        const bottomRight =
            viewer.viewport.imageToViewerElementCoordinates(
                new OpenSeadragon.Point(
                    metadata.image.width,
                    metadata.image.height
                )
            );

        const width =
            bottomRight.x -
            topLeft.x;

        const height =
            bottomRight.y -
            topLeft.y;

        targetCtx.globalCompositeOperation =
            "lighter";

        targetCtx.globalAlpha =
            layer.opacity;

        targetCtx.drawImage(
            layer.cachedCanvas,
            topLeft.x,
            topLeft.y,
            width,
            height
        );

        targetCtx.globalCompositeOperation =
            "source-over";

        targetCtx.globalAlpha =
            1;
    }
}


// Get scale length
function getNiceScaleBarLength(visibleWidthUm) {

    const target =
        visibleWidthUm * 0.2;

    const choices = [
        10,
        20,
        25,
        50,
        75,
        100,
        200,
        250,
        500,
        1000,
        2000,
        5000
    ];

    for (
        const choice
        of choices
    ) {

        if (
            choice >= target
        ) {

            return choice;
        }
    }

    return choices[
        choices.length - 1
    ];
}


// Scale bar
function drawScaleBar(ctx) {

    if (
        !metadata ||
        !metadata.web_pixel_size_um
    ) {
        return;
    }

    const bounds =
        viewer.viewport.getBounds();

    const topLeft =
        viewer.viewport.viewportToImageCoordinates(
            bounds.getTopLeft()
        );

    const bottomRight =
        viewer.viewport.viewportToImageCoordinates(
            bounds.getBottomRight()
        );

    const visibleWidthPixels =
        Math.abs(
            bottomRight.x -
            topLeft.x
        );

    const visibleWidthUm =
        visibleWidthPixels *
        metadata.web_pixel_size_um;

    const barUm =
        getNiceScaleBarLength(
            visibleWidthUm
        );

    const barImagePixels =
        barUm /
        metadata.web_pixel_size_um;

    const p1 =
        viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(
                0,
                0
            )
        );

    const p2 =
        viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(
                barImagePixels,
                0
            )
        );

    const barScreenPixels =
        p2.x - p1.x;

    const margin = 40;

    const x2 =
        ctx.canvas.width -
        margin;

    const x1 =
        x2 -
        barScreenPixels;

    const y =
        ctx.canvas.height -
        margin;

    let label;

    if (
        barUm >= 1000
    ) {

        label =
            `${barUm / 1000} mm`;

    } else {

        label =
            `${barUm} µm`;
    }


    // Black outline

    ctx.strokeStyle =
        "black";

    ctx.lineWidth = 10;

    ctx.beginPath();

    ctx.moveTo(
        x1,
        y
    );

    ctx.lineTo(
        x2,
        y
    );

    ctx.stroke();

    // White bar

    ctx.strokeStyle =
        "white";

    ctx.lineWidth = 6;

    ctx.beginPath();

    ctx.moveTo(
        x1,
        y
    );

    ctx.lineTo(
        x2,
        y
    );

    ctx.stroke();

    // Text

    ctx.font =
        "22px Arial";

    ctx.textAlign =
        "left";

    ctx.lineWidth = 4;

    ctx.strokeStyle =
        "black";

    ctx.strokeText(
        label,
        x1,
        y - 15
    );

    ctx.fillStyle =
        "white";

    ctx.fillText(
        label,
        x1,
        y - 15
    );
}


function drawSegmentations(ctx) {

    for (
        const cell
        of segmentationData
    ) {

        const isSelected =
            selectedCell === cell;

        const isHovered =
            hoveredCell === cell;

        if (isSelected) {

            overlayCtx.strokeStyle =
                "#ffff00";

            overlayCtx.lineWidth = 3;

        } else if (isHovered) {

            overlayCtx.strokeStyle =
                "#ff8800";

            overlayCtx.lineWidth = 2;

        } else {

            overlayCtx.strokeStyle =
                hexToRgba(
                    segmentationColor,
                    segmentationOpacity
                );

            overlayCtx.lineWidth = segmentationThickness;
        }

        const vertices =
            cell.vertices;

        if (!vertices.length) {
            continue;
        }

        overlayCtx.beginPath();

        vertices.forEach(
            (pt, idx) => {

                const vp =
                    viewer.viewport.imageToViewerElementCoordinates(
                        new OpenSeadragon.Point(
                            pt[0],
                            pt[1]
                        )
                    );

                if (idx === 0) {

                    overlayCtx.moveTo(
                        vp.x,
                        vp.y
                    );

                } else {

                    overlayCtx.lineTo(
                        vp.x,
                        vp.y
                    );
                }
            }
        );

        overlayCtx.closePath();

        overlayCtx.stroke();
    }
}


// Segmentation opacity
function hexToRgba(hex, alpha) {

    const r =
        parseInt(
            hex.substring(1, 3),
            16
        );

    const g =
        parseInt(
            hex.substring(3, 5),
            16
        );

    const b =
        parseInt(
            hex.substring(5, 7),
            16
        );

    return `rgba(
        ${r},
        ${g},
        ${b},
        ${alpha}
    )`;
}


function drawGenes(ctx) {

    for (
        const geneName
        in geneLayers
    ) {

        const layer =
            geneLayers[
                geneName
            ];

        const points =
            layer.points;

        overlayCtx.fillStyle =
            layer.color;

        for (
            const pt
            of points
        ) {

            const vp =
                viewer.viewport.imageToViewerElementCoordinates(
                    new OpenSeadragon.Point(
                        pt.x,
                        pt.y
                    )
                );

            overlayCtx.beginPath();

            overlayCtx.arc(
                vp.x,
                vp.y,
                layer.size,
                0,
                2 * Math.PI
            );

            overlayCtx.fill();
        }
    }
}


// Draw function
function updateOverlay() {

    if (!overlayCanvas) {
        return;
    }

    clearCanvas();

    // Proteins
    if (showProteins) {
        drawProteins();
    }

    // Segmentations
    if (
        segmentationVisible &&
        showSegs
    ) {
        drawSegmentations();
    }

    // Genes
    if (showGenes) {
        drawGenes();
    }

    // Scale bar
    if (
        showScaleBar
    ) {

        drawScaleBar(
            overlayCtx
        );
    }
}


// Draw protein
function drawProteinLayer(layer) {

    if (
        !layer.cachedCanvas
    ) {
        return;
    }

    const topLeft =
        viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(
                0,
                0
            )
        );

    const bottomRight =
        viewer.viewport.imageToViewerElementCoordinates(
            new OpenSeadragon.Point(
                metadata.image.width,
                metadata.image.height
            )
        );

    const width =
        bottomRight.x - topLeft.x;

    const height =
        bottomRight.y - topLeft.y;

    overlayCtx.globalCompositeOperation =
        "lighter";

    overlayCtx.globalAlpha =
        layer.opacity;

    overlayCtx.drawImage(
        layer.cachedCanvas,
        topLeft.x,
        topLeft.y,
        width,
        height
    );

    overlayCtx.globalCompositeOperation =
        "source-over";

    overlayCtx.globalAlpha =
        1;
}


// Draw proteins
function drawProteins(ctx) {

    for (
        const marker
        in proteinLayers
    ) {

        const layer =
            proteinLayers[marker];

        drawProteinLayer(
            layer
        );
    }
}


// Rebuild proteins
function rebuildProteinCache(layer) {

    const canvas =
        document.createElement("canvas");

    canvas.width =
        layer.image.width;

    canvas.height =
        layer.image.height;

    const ctx =
        canvas.getContext("2d");

    ctx.drawImage(
        layer.image,
        0,
        0
    );

    const imageData =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

    const data =
        imageData.data;

    const hex =
        layer.color.replace("#", "");

    const r =
        parseInt(
            hex.substring(0, 2),
            16
        );

    const g =
        parseInt(
            hex.substring(2, 4),
            16
        );

    const b =
        parseInt(
            hex.substring(4, 6),
            16
        );

    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {

        const intensity =
            data[i];

        if (
            intensity < layer.threshold
        ) {

            data[i + 3] = 0;

        } else {

            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = intensity;
        }
    }

    ctx.putImageData(
        imageData,
        0,
        0
    );

    layer.cachedCanvas =
        canvas;
}


// Active layers
function refreshActiveLayers() {

    const activeProteins =
        document.getElementById(
            "activeProteins"
        );

    const activeGenes =
        document.getElementById(
            "activeGenes"
        );

    activeProteins.innerHTML = "";
    activeGenes.innerHTML = "";

    // Genes
    for (
        const gene
        in geneLayers
    ) {

        const chip =
            document.createElement(
                "div"
            );

        chip.className =
            "layer-chip gene-chip";

        chip.innerHTML = `
            <span
                class="chip-colour"
                style="
                    background:
                    ${geneLayers[gene].color}
                "
            ></span>

            ${gene}
        `;

        activeGenes.appendChild(
            chip
        );
    }

    // Proteins
    for (
        const protein
        in proteinLayers
    ) {

        const chip =
            document.createElement(
                "div"
            );

        chip.className =
            "layer-chip protein-chip";

        chip.innerHTML = `
            <span
                class="chip-colour"
                style="
                    background:
                    ${proteinLayers[protein].color}
                "
            ></span>

            ${protein}
        `;

        activeProteins.appendChild(
            chip
        );
    }
}


// Protein UI
function refreshProteinUI() {

    loadedProteinsDiv.innerHTML = "";

    for (
        const marker
        in proteinLayers
    ) {

        const layer =
            proteinLayers[marker];

        const row =
            document.createElement(
                "div"
            );

        row.style.marginBottom =
            "10px";

        row.innerHTML = `
            <strong>${marker}</strong>

            <button
                data-marker="${marker}"
                class="remove-protein"
            >
                X
            </button>

            Colour<br>

            <input
                type="color"
                value="${layer.color}"
                data-marker="${marker}"
                class="protein-color"
            >

            <br>

            Opacity<br>

            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value="${layer.opacity}"
                data-marker="${marker}"
                class="protein-opacity"
            >

            <br>

            Threshold<br>

            <input
                type="range"
                min="0"
                max="255"
                value="${layer.threshold}"
                data-marker="${marker}"
                class="protein-threshold"
            >
        `;

        loadedProteinsDiv.appendChild(
            row
        );
    }

    attachProteinControlEvents();
}


// Protein list renderer
function renderProteinList(filter = "") {

    proteinList.innerHTML = "";

    allProteins
        .filter(
            protein =>
                protein
                .toLowerCase()
                .includes(
                    filter.toLowerCase()
                )
        )
        .forEach(
            protein => {

                const row =
                    document.createElement("div");

                row.className =
                    "search-row";

                row.innerHTML = `
                    <label>
                        <input
                            type="checkbox"
                            data-protein="${protein}"
                            ${
                                proteinLayers[protein]
                                ? "checked"
                                : ""
                            }
                        >
                        ${protein}
                    </label>
                `;

                proteinList.appendChild(row);
            }
        );

    attachProteinCheckboxEvents();
}


// Protein colours
function getUnusedProteinColor() {

    const used =
        Object.values(
            proteinLayers
        )
        .map(
            layer => layer.color
        );

    const free =
        DEFAULT_PROTEIN_COLORS.find(
            color =>
                !used.includes(
                    color
                )
        );

    return free ??
        DEFAULT_PROTEIN_COLORS[0];
}


// Attach proteins
function attachProteinCheckboxEvents() {

    document
        .querySelectorAll(
            "#proteinList input[type='checkbox']"
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    async () => {

                        const marker =
                            checkbox.dataset.protein;

                        if (
                            checkbox.checked
                        ) {

                            if (
                                proteinLayers[marker]
                            ) {
                                return;
                            }

                            const proteinPath =
                                metadata.proteins[
                                    marker
                                ].file;

                            const img =
                                new Image();

                            img.onload = () => {

                                proteinLayers[marker] = {
                                    image: img,
                                    color: getUnusedProteinColor(),
                                    opacity: proteinOpacity,
                                    threshold: 0,
                                    cachedCanvas: null
                                };

                                rebuildProteinCache(
                                    proteinLayers[marker]
                                );

                                proteinCanvas =
                                    document.createElement(
                                        "canvas"
                                    );

                                proteinCanvas.width =
                                    img.width;

                                proteinCanvas.height =
                                    img.height;

                                refreshProteinUI();
                                refreshActiveLayers();
                                updateOverlay();
                            };

                            const blob =
                                await getBlob(
                                    proteinPath
                                );

                            img.src =
                                URL.createObjectURL(
                                    blob
                                );

                        } else {

                            delete proteinLayers[
                                marker
                            ];

                            refreshProteinUI();
                            refreshActiveLayers();
                            updateOverlay();
                        }
                    }
                );
            }
        );
}


// Handle colour/opacity changes
function attachProteinControlEvents() {

    document
        .querySelectorAll(
            ".protein-color"
        )
        .forEach(
            picker => {

                picker.addEventListener(
                    "input",
                    () => {

                        const marker =
                            picker.dataset.marker;

                        proteinLayers[marker].color =
                            picker.value;

                        rebuildProteinCache(
                            proteinLayers[marker]
                        );

                        refreshActiveLayers();

                        updateOverlay();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            ".protein-opacity"
        )
        .forEach(
            slider => {

                slider.addEventListener(
                    "input",
                    () => {

                        const marker =
                            slider.dataset.marker;

                        proteinLayers[marker].opacity =
                            parseFloat(
                                slider.value
                            );

                        updateOverlay();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            ".protein-threshold"
        )
        .forEach(
            slider => {

                slider.addEventListener(
                    "input",
                    () => {

                        const marker =
                            slider.dataset.marker;

                        proteinLayers[marker].threshold =
                            parseInt(
                                slider.value
                            );

                        rebuildProteinCache(
                            proteinLayers[marker]
                        );

                        updateOverlay();
                    }
                );
            }
        );

    // Remove proteins individually
    document
        .querySelectorAll(
            ".remove-protein"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const marker =
                            button.dataset.marker;

                        delete proteinLayers[marker];

                        refreshProteinUI();
                        refreshActiveLayers();
                        renderProteinList(proteinSearch.value);
                        updateOverlay();
                    }
                );
            }
        );
}


// Convert click to image coordinates
function onViewerClick(event) {

    if (!cellSelectionEnabled) {
        return;
    }

    const viewportPoint =
        viewer.viewport.pointFromPixel(
            event.position
        );

    const imagePoint =
        viewer.viewport.viewportToImageCoordinates(
            viewportPoint
        );

    selectCellAtPoint(
        imagePoint.x,
        imagePoint.y
    );
}


// Point-in-polygon test
function pointInPolygon(x, y, vertices) {

    let inside =
        false;

    for (
        let i = 0,
        j = vertices.length - 1;
        i < vertices.length;
        j = i++
    ) {

        const xi =
            vertices[i][0];

        const yi =
            vertices[i][1];

        const xj =
            vertices[j][0];

        const yj =
            vertices[j][1];

        const intersect =
            (
                (yi > y) !==
                (yj > y)
            )
            &&
            (
                x <
                (
                    (xj - xi) *
                    (y - yi)
                ) /
                (
                    yj - yi
                ) +
                xi
            );

        if (
            intersect
        ) {

            inside =
                !inside;
        }
    }

    return inside;
}


// Select a cell
function selectCellAtPoint(x, y) {

    for (
        const cell
        of segmentationData
    ) {

        if (
            pointInPolygon(
                x,
                y,
                cell.vertices
            )
        ) {

            selectedCell =
                cell;

            const area =
                calculatePolygonArea(
                    cell.vertices
                );

            const centroid =
                calculateCentroid(
                    cell.vertices
                );
            
            // Gene count
            const transcriptCount =
                countGenesInCell(
                    cell
                );

            // Selected cell information panel
            cellInfo.innerHTML =
                `
                <b>Cell Selected</b><br>

                Cell ID:
                ${
                    cell.cell_id ??
                    "Unknown"
                }
                <br>

                Vertices:
                ${
                    cell.vertices.length
                }
                <br>

                Area:
                ${
                    Math.round(area)
                }
                px²
                <br>

                Centroid:
                (
                ${
                    Math.round(
                        centroid.x
                    )
                },
                ${
                    Math.round(
                        centroid.y
                    )
                }
                )

                <br>

                <b>Genes</b><br>

                ${
                    Object.entries(
                        transcriptCount
                    )
                    .map(
                        ([gene, count]) =>
                            `${gene}: ${count}`
                    )
                    .join("<br>")
                }

                `;

            cellInfo.style.display =
                "block";

            updateOverlay();

            return;
        }
    }

    selectedCell = null;

    cellInfo.textContent =
        "No cell selected";

    cellInfo.style.display =
        "none";

    updateOverlay();
}


// Mouse position
function onViewerMove(event) {

    if (!cellSelectionEnabled) {
        return;
    }

    const rect =
        viewer.container.getBoundingClientRect();

    const pixelPoint =
        new OpenSeadragon.Point(
            event.clientX - rect.left,
            event.clientY - rect.top
        );

    const viewportPoint =
        viewer.viewport.pointFromPixel(
            pixelPoint
        );

    const imagePoint =
        viewer.viewport.viewportToImageCoordinates(
            viewportPoint
        );

    updateHoveredCell(
        imagePoint.x,
        imagePoint.y
    );
}


// Find hovered cell
function updateHoveredCell(x, y) {

    let newHoveredCell =
        null;

    for (
        const cell
        of segmentationData
    ) {

        if (
            pointInPolygon(
                x,
                y,
                cell.vertices
            )
        ) {

            newHoveredCell =
                cell;

            break;
        }
    }

    if (
        hoveredCell !==
        newHoveredCell
    ) {

        hoveredCell =
            newHoveredCell;

        updateOverlay();
    }
}


// Cell area
function calculatePolygonArea(vertices) {

    let area = 0;

    for (
        let i = 0;
        i < vertices.length;
        i++
    ) {

        const j =
            (
                i + 1
            ) %
            vertices.length;

        area +=
            vertices[i][0] *
            vertices[j][1];

        area -=
            vertices[j][0] *
            vertices[i][1];
    }

    return Math.abs(
        area / 2
    );
}


// Cell centroid
function calculateCentroid(vertices) {

    let x = 0;
    let y = 0;

    for (
        const vertex
        of vertices
    ) {

        x += vertex[0];
        y += vertex[1];
    }

    return {

        x:
            x /
            vertices.length,

        y:
            y /
            vertices.length
    };
}


// Gene counts in cell
function countGenesInCell(cell) {

    const counts = {};

    for (
        const geneName
        in geneLayers
    ) {

        let count = 0;

        const points =
            geneLayers[
                geneName
            ].points;

        for (
            const point
            of points
        ) {

            if (
                pointInPolygon(
                    point.x,
                    point.y,
                    cell.vertices
                )
            ) {

                count++;
            }
        }

        counts[
            geneName
        ] = count;
    }

    return counts;
}


// Gene UI
function refreshGeneUI() {

    loadedGenesDiv.innerHTML = "";

    for (
        const geneName
        in geneLayers
    ) {

        const layer =
            geneLayers[
                geneName
            ];

        const row =
            document.createElement(
                "div"
            );

        row.style.marginBottom =
            "10px";

        row.innerHTML = `
            <strong>${geneName}</strong>

            <button
                data-gene="${geneName}"
                class="remove-gene"
            >
                X
            </button>

            <br>

            Colour

            <br>

            <input
                type="color"
                value="${layer.color}"
                data-gene="${geneName}"
                class="gene-color"
            >

            <br>

            Dot Size

            <br>

            <input
                type="range"
                min="1"
                max="20"
                value="${layer.size}"
                data-gene="${geneName}"
                class="gene-size"
            >
        `;

        loadedGenesDiv.appendChild(
            row
        );
    }

    attachGeneControlEvents();
}


// Gene list renderer
function renderGeneList(filter = "") {

    geneList.innerHTML = "";

    allGenes
        .filter(
            gene =>
                gene
                .toLowerCase()
                .includes(
                    filter.toLowerCase()
                )
        )
        .forEach(
            gene => {

                const row =
                    document.createElement("div");

                row.className =
                    "search-row";

                row.innerHTML = `
                    <label>
                        <input
                            type="checkbox"
                            data-gene="${gene}"
                            ${
                                geneLayers[gene]
                                ? "checked"
                                : ""
                            }
                        >
                        ${gene}
                    </label>
                `;

                geneList.appendChild(row);
            }
        );

    attachGeneCheckboxEvents();
}


// Attach genes
function attachGeneCheckboxEvents() {

    document
        .querySelectorAll(
            "#geneList input[type='checkbox']"
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    async () => {

                        const geneName =
                            checkbox.dataset.gene;

                        if (
                            checkbox.checked
                        ) {

                            if (
                                geneLayers[geneName]
                            ) {
                                return;
                            }

                            const filename =
                                metadata.genes[
                                    geneName
                                ];

                            const compressed =
                                await getCompressedFile(
                                    `genes/${filename}`
                                );

                            const jsonText =
                                pako.inflate(
                                    compressed,
                                    {
                                        to: "string"
                                    }
                                );

                            geneLayers[geneName] = {

                                points:
                                    JSON.parse(jsonText),

                                color:
                                    getUnusedGeneColor(),

                                size: 3
                            };

                        } else {

                            delete geneLayers[
                                geneName
                            ];
                        }

                        refreshGeneUI();
                        refreshActiveLayers();
                        updateOverlay();
                    }
                );
            }
        );
}


// Gene colours
function getUnusedGeneColor() {

    const used =
        Object.values(
            geneLayers
        )
        .map(
            layer => layer.color
        );

    const free =
        DEFAULT_GENE_COLORS.find(
            color =>
                !used.includes(
                    color
                )
        );

    return free ??
        DEFAULT_GENE_COLORS[0];
}


// Remove genes
function attachGeneControlEvents() {

    document
        .querySelectorAll(
            ".gene-color"
        )
        .forEach(
            picker => {

                picker.addEventListener(
                    "input",
                    () => {

                        const gene =
                            picker.dataset.gene;

                        geneLayers[gene].color =
                            picker.value;

                        refreshActiveLayers();
                        updateOverlay();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            ".gene-size"
        )
        .forEach(
            slider => {

                slider.addEventListener(
                    "input",
                    () => {

                        const gene =
                            slider.dataset.gene;

                        geneLayers[gene].size =
                            parseInt(
                                slider.value
                            );

                        console.log(
                            gene,
                            geneLayers[
                                gene
                            ].size
                        );

                        updateOverlay();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            ".remove-gene"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const gene =
                            button.dataset.gene;

                        delete geneLayers[gene];

                        refreshGeneUI();
                        refreshActiveLayers();
                        renderGeneList(geneSearch.value);
                        updateOverlay();
                    }
                );
            }
        );
}


// Protein/gene browse/load tabs
function showProteinBrowse() {

    document
        .getElementById("proteinBrowseView")
        .style.display = "flex";

    document
        .getElementById("proteinLoadedView")
        .style.display = "none";
}

function showProteinLoaded() {

    document
        .getElementById("proteinBrowseView")
        .style.display = "none";

    document
        .getElementById("proteinLoadedView")
        .style.display = "flex";
}

function showGeneBrowse() {

    document
        .getElementById("geneBrowseView")
        .style.display = "flex";

    document
        .getElementById("geneLoadedView")
        .style.display = "none";
}

function showGeneLoaded() {

    document
        .getElementById("geneBrowseView")
        .style.display = "none";

    document
        .getElementById("geneLoadedView")
        .style.display = "flex";
}

document
    .getElementById("proteinBrowseBtn")
    .addEventListener("click", showProteinBrowse);

document
    .getElementById("proteinLoadedBtn")
    .addEventListener("click", showProteinLoaded);

document
    .getElementById("geneBrowseBtn")
    .addEventListener("click", showGeneBrowse);

document
    .getElementById("geneLoadedBtn")
    .addEventListener("click", showGeneLoaded);

// Show panels if on phone
if (window.innerWidth <= 768) {
    showProteinBrowse();
    showGeneBrowse();

    showMobileTopSection(
        "dataSection"
    );
}


// Mobile tabs
function showMobileTopSection(id) {

    document
        .getElementById(
            "topbar"
        )
        .classList.remove(
            "collapsed"
        );

    document
        .querySelectorAll(".mobileTopSection")
        .forEach(section =>
            section.classList.remove("active")
        );

    document
        .getElementById(id)
        .classList.add("active");


    document
        .querySelectorAll("#mobileTopTabs button")
        .forEach(button =>
            button.classList.remove("active")
        );

    if (id === "dataSection") {
        document
            .getElementById("mobileDataTab")
            .classList.add("active");
    }

    if (id === "displaySection") {
        document
            .getElementById("mobileDisplayTab")
            .classList.add("active");
    }

    if (id === "screenshotSection") {
        document
            .getElementById("mobileScreenshotTab")
            .classList.add("active");
    }
}


// Hide tabs
function hideMobileTopSections() {

    document
        .querySelectorAll(
            ".mobileTopSection"
        )
        .forEach(
            section =>
                section.classList.remove(
                    "active"
                )
        );

    document
        .querySelectorAll(
            "#mobileTopTabs button"
        )
        .forEach(
            button =>
                button.classList.remove(
                    "active"
                )
        );

    document
        .getElementById(
            "topbar"
        )
        .classList.add(
            "collapsed"
        );
}


// Close tabs when clicking viewer
viewerWrapper.addEventListener(
    "click",
    () => {

        hideMobileTopSections();

        document
            .getElementById("proteinPanel")
            .classList.remove("open");

        document
            .getElementById("genePanel")
            .classList.remove("open");
    }
);


document
    .getElementById(
        "mobileDataTab"
    )
    .addEventListener(
        "click",
        () =>
            showMobileTopSection(
                "dataSection"
            )
    );

document
    .getElementById(
        "mobileDisplayTab"
    )
    .addEventListener(
        "click",
        () =>
            showMobileTopSection(
                "displaySection"
            )
    );

document
    .getElementById(
        "mobileScreenshotTab"
    )
    .addEventListener(
        "click",
        () =>
            showMobileTopSection(
                "screenshotSection"
            )
    );


document
    .getElementById("toggleLayersBtn")
    .addEventListener(
        "click",
        () => {

            const layerBar =
                document.getElementById(
                    "layerBar"
                );

            layerBar.classList.toggle(
                "hidden"
            );

            btn.textContent =
                layerBar.classList.contains(
                    "hidden"
                )
                    ? "Active Layers ▶"
                    : "Active Layers ▼";
        }
    );


// Load file from drag and drop
dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );
    }
);

dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove(
            "dragging"
        );
    }
);

dropZone.addEventListener(
    "drop",
    async event => {

        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );

        const file =
            event.dataTransfer.files[0];

        await loadUlviewer(
            file
        );
    }
);


// Checkbox H&E
exportHE.addEventListener(
    "change",
    () => {

        showHELayer =
            exportHE.checked;

        if (
            viewer &&
            viewer.world &&
            viewer.world.getItemCount() > 0
        ) {

            viewer
                .world
                .getItemAt(0)
                .setOpacity(
                    showHELayer
                        ? heOpacity
                        : 0
                );
        }
    }
);


// Checkbox genes
exportGenes.addEventListener(
    "change",
    () => {

        showGenes =
            exportGenes.checked;

        updateOverlay();
    }
);


// Checkbox proteins
exportProteins.addEventListener(
    "change",
    () => {

        showProteins =
            exportProteins.checked;

        updateOverlay();
    }
);


// Checkbox segmentation
exportSegs.addEventListener(
    "change",
    () => {

        showSegs =
            exportSegs.checked;

        updateOverlay();
    }
);


// Checkbox scale bar
exportScaleBar.addEventListener(
    "change",
    () => {

        showScaleBar =
            exportScaleBar.checked;

        updateOverlay();
    }
);


// Save screenshot
saveScreenshotBtn.addEventListener(
    "click",
    saveScreenshot
);


// H&E opacity
heOpacitySlider.addEventListener(
    "input",
    () => {

        heOpacity =
            parseFloat(
                heOpacitySlider.value
            );

        if (
            viewer &&
            viewer.world &&
            viewer.world.getItemCount() > 0
        ) {

            viewer
                .world
                .getItemAt(0)
                .setOpacity(
                    heOpacity
                );
        }
    }
);


// Load ulviewer
document
    .getElementById(
        "ulviewerFile"
    )
    .addEventListener(
        "change",
        async event => {

            const file =
                event.target.files[0];

            await loadUlviewer(
                file
            );
        }
    );

document.addEventListener(
    "dragover",
    event => {

        event.preventDefault();
    }
);

document.addEventListener(
    "drop",
    async event => {

        event.preventDefault();

        const file =
            event.dataTransfer.files[0];

        if (
            !file
        ) {
            return;
        }

        await loadUlviewer(
            file
        );
    }
);

// Load data from web link
const loadUrlBtn =
    document.getElementById(
        "loadUrlBtn"
    );

if (loadUrlBtn) {

    loadUrlBtn.addEventListener(
        "click",
        async () => {

            const url =
                document
                .getElementById(
                    "urlInput"
                )
                .value;

            const response =
                await fetch(
                    url
                );

            const fileBlob =
                await response.blob();

            await loadUlviewer(
                fileBlob
            );
        }
    );
}

// Load demo dataset
async function loadDemoDataset() {

    loadedZip = null;

    datasetRoot = "./data";

    metadata =
        await fetch(
            `${datasetRoot}/metadata.json`
        ).then(
            r => r.json()
        );

    await initialiseDataset();

    // Mobile-specific conditions
    if (
        window.innerWidth <= 768
    ) {

        showMobileTopSection(
            "displaySection"
        );
    }
}

document
    .getElementById("loadDemoBtn")
    .addEventListener(
        "click",
        loadDemoDataset
    );

// Load segmentation
document
    .getElementById(
        "loadSegBtn"
    )
    .addEventListener(
        "click",
        async () => {

            const filename =
                metadata.segmentations[
                    "xenium_cells"
                ];

            console.log(
                "Segmentation:",
                filename
            );

            const compressed =
                await getCompressedFile(
                    filename
                );

            const jsonText =
                pako.inflate(
                    compressed,
                    {
                        to: "string"
                    }
                );

            segmentationData =
                JSON.parse(
                    jsonText
                );

            document
                .getElementById(
                    "enableCellSelection"
                )
                .disabled = false;

            document
                .getElementById(
                    "loadSegBtn"
                )
                .style.display = "none";

            document
                .getElementById(
                    "segmentationControls"
                )
                .style.display = "flex";

            updateOverlay();
        }
    );

// Segmentation line colour
document
    .getElementById(
        "segmentationColor"
    )
    .addEventListener(
        "input",
        event => {

            segmentationColor =
                event.target.value;

            updateOverlay();
        }
    );

// Segmentation line thickness
document
    .getElementById(
        "segmentationThickness"
    )
    .addEventListener(
        "input",
        event => {

            segmentationThickness =
                parseFloat(
                    event.target.value
                );

            updateOverlay();
        }
    );

// Segmentation opacity
document
    .getElementById(
        "segmentationOpacity"
    )
    .addEventListener(
        "input",
        event => {

            segmentationOpacity =
                parseFloat(
                    event.target.value
                );

            updateOverlay();
        }
    );


// Gene search
geneSearch.addEventListener(
    "input",
    () => {

        renderGeneList(
            geneSearch.value
        );
    }
);


// Clear genes
document
    .getElementById(
        "clearGenesBtn"
    )
    .addEventListener(
        "click",
        () => {

            geneLayers = {};

            refreshGeneUI();
            refreshActiveLayers();

            renderGeneList(
                geneSearch.value
            );

            updateOverlay();
        }
    );


// Protein search
proteinSearch.addEventListener(
    "input",
    () => {

        renderProteinList(
            proteinSearch.value
        );
    }
);


// Clear proteins
document
    .getElementById(
        "clearProteinsBtn"
    )
    .addEventListener(
        "click",
        () => {

            proteinLayers = {};

            refreshProteinUI();
            refreshActiveLayers();

            renderProteinList(
                proteinSearch.value
            );

            updateOverlay();
        }
    );

// Cell info selection
enableCellSelection.addEventListener(
    "change",
    () => {

        cellSelectionEnabled =
            enableCellSelection.checked;

        if (
            !cellSelectionEnabled
        ) {

            selectedCell = null;
            hoveredCell = null;

            cellInfo.style.display =
                "none";

            updateOverlay();
        }
    }
);


// Side tabs (for phones)
document
    .getElementById("proteinTab")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("genePanel")
                .classList.remove("open");

            document
                .getElementById("proteinPanel")
                .classList.toggle("open");
        }
    );

document
    .getElementById("geneTab")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("proteinPanel")
                .classList.remove("open");

            document
                .getElementById("genePanel")
                .classList.toggle("open");
        }
    );

