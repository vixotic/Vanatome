"use client";

import {
  Activity,
  Box,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Rotate3d,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  ZoomIn,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  AtlasLoaderError,
  createOfficialHumanAtlas,
  type AtlasLoaderState,
  type LoadedAtlasBundle,
} from "@vixotic/vanatome-atlas";
import { useVanatomeController } from "@vixotic/vanatome-react";
import type { VanatomeHierarchyNode } from "@vixotic/vanatome-react";
import {
  createAnatomyData,
  type AnatomyData,
  type AnatomyStructure,
} from "../data/anatomy";
import {
  ATLAS_ATTRIBUTION_URL,
  ATLAS_CATALOG_URL,
} from "../config/atlas";

const AnatomyScene = dynamic(
  () => import("./AnatomyScene").then((module) => module.AnatomyScene),
  {
    ssr: false,
    loading: () => (
      <div className="scene-loading">
        <div className="scanner-ring" />
        <span>Calibrating volumetric field</span>
      </div>
    ),
  },
);

export function AnatomyExplorer() {
  const loader = useMemo(
    () => createOfficialHumanAtlas({ catalogUrl: ATLAS_CATALOG_URL }),
    [],
  );
  const [loaderState, setLoaderState] = useState<AtlasLoaderState>(
    loader.getState(),
  );
  const [bundle, setBundle] = useState<LoadedAtlasBundle | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = loader.subscribe(setLoaderState);
    void loader
      .loadBundle("curated-full-body", { signal: controller.signal })
      .then(setBundle)
      .catch((reason: unknown) => {
        if (
          reason instanceof AtlasLoaderError &&
          reason.code === "aborted"
        ) {
          return;
        }
      });
    return () => {
      unsubscribe();
      controller.abort();
    };
  }, [attempt, loader]);

  if (!bundle) {
    return (
      <AtlasLoadScreen
        state={loaderState}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  return <LoadedAnatomyExplorer bundle={bundle} />;
}

function AtlasLoadScreen({
  state,
  onRetry,
}: {
  state: AtlasLoaderState;
  onRetry: () => void;
}) {
  const failed = state.status === "error";
  const message = state.status === "loading-bundle"
    ? "Loading full-body anatomy"
    : state.status === "catalog-ready"
      ? "Preparing full-body anatomy"
      : failed
        ? "Atlas connection unavailable"
        : "Loading atlas catalog";

  return (
    <main className="app-shell atlas-load-shell" aria-live="polite">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Box size={20} strokeWidth={1.6} />
          </div>
          <div>
            <div className="brand-name">Vanatome</div>
            <div className="brand-subtitle">HUMAN SYSTEMS ATLAS</div>
          </div>
        </div>
        <div className={`status-pill ${failed ? "status-error" : ""}`}>
          <span className="status-dot" />
          {failed ? "ATLAS OFFLINE" : "ATLAS CONNECTING"}
        </div>
      </header>
      <section className="atlas-load-state">
        {!failed && <div className="scanner-ring" aria-hidden="true" />}
        <span className="eyebrow">
          {failed ? "CONNECTION ERROR" : "CURATED FULL-BODY RELEASE"}
        </span>
        <h1>{message}</h1>
        <p>
          {failed
            ? state.error.message
            : "Retrieving the versioned catalog and validated anatomy metadata."}
        </p>
        {failed && (
          <button type="button" className="atlas-retry" onClick={onRetry}>
            <RotateCcw size={15} />
            RETRY ATLAS
          </button>
        )}
      </section>
      <footer className="footer">
        <span>Z-ANATOMY • CURATED HUMAN ATLAS</span>
        <a href={ATLAS_ATTRIBUTION_URL} target="_blank" rel="noreferrer">
          OPEN MODEL ATTRIBUTION
        </a>
      </footer>
    </main>
  );
}

function LoadedAnatomyExplorer({ bundle }: { bundle: LoadedAtlasBundle }) {
  const anatomy = useMemo<AnatomyData>(
    () => createAnatomyData(bundle),
    [bundle],
  );
  const {
    registry: anatomyRegistry,
    byId: anatomyById,
    hierarchy: anatomyHierarchy,
    layers: anatomyLayers,
    mappedNodeCount: atlasMappedNodeCount,
  } = anatomy;
  const initialLayers = useMemo(
    () => anatomyLayers.map((layer) => layer.id),
    [anatomyLayers],
  );
  const viewer = useVanatomeController(initialLayers);
  const [query, setQuery] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(anatomyHierarchy.map((structure) => structure.id)),
  );
  const selected = viewer.selectedId ? anatomyById[viewer.selectedId] : null;
  const rightPanelExpanded = isCompact ? mobilePanelOpen : rightOpen;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return anatomyRegistry;
    return anatomyRegistry.filter(
      (organ) =>
        organ.name.toLowerCase().includes(needle) ||
        organ.system.toLowerCase().includes(needle),
    );
  }, [anatomyRegistry, query]);

  const choose = (id: string | null) => {
    viewer.select(id);
    if (!id) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      let parentId = anatomyById[id]?.parentId;
      while (parentId) {
        next.add(parentId);
        parentId = anatomyById[parentId]?.parentId;
      }
      return next;
    });
    setRightOpen(true);
    setMobilePanelOpen(true);
    setQuery("");
  };

  const renderStructure = (
    structure: AnatomyStructure | VanatomeHierarchyNode,
    index: number,
    depth = 0,
    flat = false,
  ) => {
    const children = "children" in structure ? structure.children : [];
    const hasChildren = children.length > 0;
    const expanded = expandedIds.has(structure.id);
    const selectAndToggle = () => {
      choose(structure.id);
      if (!hasChildren) return;
      setExpandedIds((current) => {
        const next = new Set(current);
        if (next.has(structure.id)) next.delete(structure.id);
        else next.add(structure.id);
        return next;
      });
    };
    return (
      <div className="structure-branch" key={structure.id}>
        <button
          type="button"
          role={flat ? "option" : "treeitem"}
          aria-selected={structure.id === viewer.selectedId}
          aria-expanded={hasChildren ? expanded : undefined}
          className={`structure-item depth-${Math.min(depth, 3)} ${
            structure.id === viewer.selectedId ? "active" : ""
          }`}
          onClick={selectAndToggle}
        >
          <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="item-copy">
            <strong>{structure.name}</strong>
            <small>{structure.system}</small>
          </span>
          {hasChildren && expanded
            ? <ChevronDown size={15} aria-hidden="true" />
            : <ChevronRight size={15} aria-hidden="true" />}
        </button>
        {!flat && hasChildren && expanded && (
          <div className="structure-children" role="group">
            {children.map((child) =>
              renderStructure(
                child,
                anatomyRegistry.findIndex((candidate) => candidate.id === child.id),
                depth + 1,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const toggleRightPanel = () => {
    if (isCompact) {
      setRightOpen(true);
      setMobilePanelOpen((open) => !open);
      return;
    }

    if (rightOpen) {
      setMobilePanelOpen(false);
      setRightOpen(false);
    } else {
      setRightOpen(true);
      if (selected) setMobilePanelOpen(true);
    }
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Box size={20} strokeWidth={1.6} />
          </div>
          <div>
            <div className="brand-name">Vanatome</div>
            <div className="brand-subtitle">HUMAN SYSTEMS ATLAS</div>
          </div>
        </div>

        <div className="status-pill">
          <span className="status-dot" />
          FULL BODY ONLINE
        </div>

        <div className="topbar-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setLeftOpen((open) => !open)}
            aria-label={leftOpen ? "Collapse anatomy browser" : "Expand anatomy browser"}
            aria-expanded={leftOpen}
            aria-controls="anatomy-browser"
          >
            {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={toggleRightPanel}
            aria-label={rightPanelExpanded ? "Collapse anatomy details" : "Expand anatomy details"}
            aria-expanded={rightPanelExpanded}
            aria-controls="anatomy-details"
          >
            {rightPanelExpanded ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </header>

      <section
        className={`workspace ${leftOpen ? "" : "left-collapsed"} ${rightOpen ? "" : "right-collapsed"}`}
      >
        {leftOpen && (
          <aside
            id="anatomy-browser"
            className="left-rail"
            aria-label="Anatomy structure browser"
          >
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search anatomy"
                aria-label="Search anatomy"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </label>

            <div className="layer-controls" aria-label="Anatomy layers">
              <span className="layer-label">
                <Layers3 size={13} />
                LAYERS
              </span>
              <div className="layer-chips">
                {anatomyLayers.map((layer) => {
                  const active = viewer.visibleLayers.includes(layer.id);
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={`layer-chip ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => viewer.toggleLayer(layer.id)}
                    >
                      {layer.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rail-heading">
              <span>{query ? "SEARCH RESULTS" : "HIERARCHY"}</span>
              <span>{String(matches.length).padStart(2, "0")}</span>
            </div>

            <div
              className="structure-list"
              role={query ? "listbox" : "tree"}
              aria-label="Anatomy structures"
            >
              {query
                ? matches.map((structure, index) =>
                    renderStructure(structure, index, 0, true),
                  )
                : anatomyHierarchy.map((structure, index) =>
                    renderStructure(structure, index),
                  )}
              {matches.length === 0 && (
                <div className="empty-search">
                  No structures match “{query}”.
                </div>
              )}
            </div>

            <div className="rail-footnote">
              <ShieldCheck size={15} />
              <span>Educational visualization</span>
            </div>
          </aside>
        )}

        <section className="viewer" aria-label="Interactive 3D human anatomy model">
          <AnatomyScene
            atlas={anatomy.atlas}
            selectedId={viewer.selectedId}
            isolatedId={viewer.isolatedId}
            visibleLayers={viewer.visibleLayers}
            focusRequestKey={viewer.focusRequestKey}
            resetViewKey={viewer.resetViewKey}
            onSelect={choose}
          />

          <div className="viewer-label">
            <span className="eyebrow">
              {selected ? "SELECTED STRUCTURE" : "FULL BODY SCAN"}
            </span>
            <h1>{selected?.name ?? "Human overview"}</h1>
            <span className="coordinate">
              <Crosshair size={13} />
              {selected ? "FOCUS LOCKED" : "AWAITING SELECTION"}
            </span>
          </div>

          <button
            className="reset-view-button"
            type="button"
            onClick={viewer.reset}
          >
            <RotateCcw size={15} />
            RESET VIEW
          </button>

          <div className="reticle" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="viewer-controls" aria-label="3D controls hint">
            <span><Rotate3d size={15} /> DRAG TO ROTATE</span>
            <span><ZoomIn size={15} /> SCROLL TO ZOOM</span>
          </div>

          <div className="scan-status">
            <Activity size={14} />
            <span>LIVE RENDER</span>
            <i />
          </div>
        </section>

        {rightOpen && (
          <aside
            id="anatomy-details"
            className={`info-panel ${mobilePanelOpen ? "mobile-open" : ""}`}
            aria-label="Anatomy details"
          >
            <button
              type="button"
              className="panel-close"
              aria-label="Close information panel"
              onClick={() => setMobilePanelOpen(false)}
            >
              <X size={20} />
            </button>

            {selected ? (
              <>
                <div className="panel-code">REF / {selected.id.toUpperCase()}</div>
                <div
                  className="organ-icon"
                  style={{ "--organ-color": selected.color } as React.CSSProperties}
                >
                  <Activity size={28} strokeWidth={1.3} />
                </div>
                <span className="eyebrow">{selected.system.toUpperCase()} SYSTEM</span>
                <h2>{selected.name}</h2>
                <p className="summary">{selected.summary}</p>

                <div className="panel-actions">
                  <button
                    type="button"
                    className={`panel-action ${viewer.isolatedId ? "active" : ""}`}
                    aria-pressed={viewer.isolatedId === selected.id}
                    onClick={() =>
                      viewer.isolate(
                        viewer.isolatedId === selected.id ? null : selected.id,
                      )
                    }
                  >
                    {viewer.isolatedId === selected.id ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                    {viewer.isolatedId === selected.id ? "SHOW ALL" : "ISOLATE"}
                  </button>
                  <button
                    type="button"
                    className="panel-action"
                    onClick={() => viewer.focus(selected.id)}
                  >
                    <Crosshair size={15} />
                    FOCUS
                  </button>
                </div>

                <div className="data-block">
                  <span className="data-label">PRIMARY FUNCTION</span>
                  <p>{selected.function}</p>
                </div>

                <div className="data-block fact-block">
                  <span className="data-label">SYSTEM NOTE</span>
                  <p>{selected.fact}</p>
                </div>

                <div className="panel-meter">
                  <div className="meter-copy">
                    <span>MODEL CONFIDENCE</span>
                    <span>CONCEPTUAL</span>
                  </div>
                  <div className="meter-track"><span /></div>
                </div>
              </>
            ) : (
              <div className="empty-detail">
                <div className="organ-icon">
                  <Info size={28} strokeWidth={1.3} />
                </div>
                <span className="eyebrow">ANATOMY DETAILS</span>
                <h2>No structure selected</h2>
                <p className="summary">
                  Search or choose an organ to focus the model and inspect its role.
                  Your manual camera position stays untouched until you select an organ
                  or use Reset view.
                </p>
              </div>
            )}

            <p className="medical-note">
              Simplified educational model. Not intended for diagnosis or clinical guidance.
            </p>
          </aside>
        )}
        {rightOpen && mobilePanelOpen && (
          <button
            className="panel-backdrop"
            type="button"
            aria-label="Close information panel"
            onClick={() => setMobilePanelOpen(false)}
          />
        )}
      </section>

      <footer className="footer">
        <span>Z-ANATOMY MODEL • {atlasMappedNodeCount} MAPPED NODES • FULL-BODY SHELL</span>
        <a href={anatomy.attributionUrl} target="_blank" rel="noreferrer">
          OPEN MODEL ATTRIBUTION
        </a>
      </footer>
    </main>
  );
}
