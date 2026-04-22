import { getDocument } from "./build/pdf.mjs";
import { PDFViewerApplication } from "./web/viewer.mjs";

function loadConfig() {
  const elem = document.getElementById("pdf-preview-config");
  const config = elem?.getAttribute("data-config");
  if (config) {
    return JSON.parse(config);
  }
  throw new Error("Could not load configuration.");
}

function cursorTool(name) {
  if (name === "hand") {
    return 1;
  }
  return 0;
}

function scrollMode(name) {
  switch (name) {
    case "vertical":
      return 0;
    case "horizontal":
      return 1;
    case "wrapped":
      return 2;
    default:
      return -1;
  }
}

function spreadMode(name) {
  switch (name) {
    case "none":
      return 0;
    case "odd":
      return 1;
    case "even":
      return 2;
    default:
      return -1;
  }
}

function getAssetUrl(path) {
  return new URL(path, import.meta.url).toString();
}

function createLoadOptions(config) {
  return {
    url: config.path,
    useWorkerFetch: false,
    cMapUrl: getAssetUrl("./web/cmaps/"),
    cMapPacked: true,
    iccUrl: getAssetUrl("./web/iccs/"),
    standardFontDataUrl: getAssetUrl("./web/standard_fonts/"),
    wasmUrl: getAssetUrl("./web/wasm/"),
  };
}

async function createDocument(loadOptions, fingerprint) {
  const loadingTask = getDocument(loadOptions);
  const doc = await loadingTask.promise;
  doc._pdfInfo.fingerprints = [fingerprint];
  return doc;
}

function applyDefaults(defaults) {
  PDFViewerApplication.pdfCursorTools.switchTool(cursorTool(defaults.cursor));
  PDFViewerApplication.pdfViewer.currentScaleValue = defaults.scale;
  PDFViewerApplication.pdfViewer.scrollMode = scrollMode(defaults.scrollMode);
  PDFViewerApplication.pdfViewer.spreadMode = spreadMode(defaults.spreadMode);

  if (defaults.sidebar) {
    PDFViewerApplication.pdfSidebar.open();
    return;
  }
  PDFViewerApplication.pdfSidebar.close();
}

async function openInitialDocument(config, loadOptions) {
  PDFViewerApplication.setTitleUsingUrl(config.path, config.path);
  await PDFViewerApplication.open({
    url: config.path,
    originalUrl: config.path,
  });

  const doc = await createDocument(loadOptions, config.path);
  PDFViewerApplication.load(doc);
}

async function reloadDocument(config, loadOptions) {
  const viewer = PDFViewerApplication.pdfViewer;
  const oldResetView = viewer._resetView;

  viewer._resetView = function () {
    this._firstPageCapability = Promise.withResolvers();
    this._onePageRenderedCapability = Promise.withResolvers();
    this._pagesCapability = Promise.withResolvers();
    this.viewer.textContent = "";
  };

  try {
    const doc = await createDocument(loadOptions, config.path);
    PDFViewerApplication.load(doc);
  } finally {
    viewer._resetView = oldResetView;
  }
}

const config = loadConfig();
const loadOptions = createLoadOptions(config);

window.addEventListener(
  "load",
  async () => {
    PDFViewerApplication.eventBus.on("documentloaded", () => {
      applyDefaults(config.defaults);
    });

    await PDFViewerApplication.initializedPromise;
    await openInitialDocument(config, loadOptions);

    window.addEventListener("message", async (event) => {
      if (event.data?.type !== "reload") {
        return;
      }
      await reloadDocument(config, loadOptions);
    });
  },
  { once: true }
);

window.onerror = function () {
  const msg = document.createElement("body");
  msg.innerText = "An error occurred while loading the file. Please open it again.";
  document.body = msg;
};
