"use client";

import {
  Activity,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  Layers3,
  Move,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtlasLoaderError,
  createDemoHumanAtlas,
  createOfficialHumanAtlas,
  type AtlasCatalog,
  type AtlasLoaderState,
  type LoadedAtlasBundle,
} from "@vixotic/vanatome-atlas";
import { useVanatomeController } from "@vixotic/vanatome-react";
import type {
  VanatomeContextMenuEvent,
  VanatomeHierarchyNode,
  VanatomeIsolationMode,
} from "@vixotic/vanatome-react";
import {
  createAnatomyData,
  type AnatomyData,
  type AnatomyStructure,
} from "../data/anatomy";
import {
  ATLAS_ATTRIBUTION_URL,
  ATLAS_CATALOG_IS_DEMO,
  ATLAS_CATALOG_URL,
} from "../config/atlas";

type MobileNavigationPanel = "browse" | "systems" | null;
type SystemLoadMode = "incremental" | "full-body";

const INITIAL_SYSTEM_ID = "regional-anatomy";

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
    () =>
      ATLAS_CATALOG_IS_DEMO
        ? createDemoHumanAtlas({ catalogUrl: ATLAS_CATALOG_URL })
        : createOfficialHumanAtlas({ catalogUrl: ATLAS_CATALOG_URL }),
    [],
  );
  const [loaderState, setLoaderState] = useState<AtlasLoaderState>(
    loader.getState(),
  );
  const [catalog, setCatalog] = useState<AtlasCatalog | null>(null);
  const [bundles, setBundles] = useState<readonly LoadedAtlasBundle[]>([]);
  const [activeSystemIds, setActiveSystemIds] = useState<readonly string[]>([
    INITIAL_SYSTEM_ID,
  ]);
  const [deliveryMode, setDeliveryMode] = useState<SystemLoadMode>("incremental");
  const [switchingBundle, setSwitchingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const loadSystems = useCallback((
    systemIds: readonly string[],
    mode: SystemLoadMode = "incremental",
  ) => {
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    activeController.current?.abort();
    setBundleError(null);

    if (deliveryMode === "full-body" && mode === "incremental") {
      activeController.current = null;
      setActiveSystemIds([...systemIds]);
      setSwitchingBundle(false);
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setSwitchingBundle(true);
    const pending = mode === "full-body"
      ? loader.loadProfile("full-body", { signal: controller.signal })
          .then((bundle) => [bundle] as readonly LoadedAtlasBundle[])
      : loader.loadSystems(systemIds, {
          signal: controller.signal,
          concurrency: 3,
        }).then((collection) => collection.bundles);
    void pending
      .then((nextBundles) => {
        if (requestId.current !== nextRequestId) return;
        setBundles(nextBundles);
        setActiveSystemIds([...systemIds]);
        setDeliveryMode(mode);
      })
      .catch((reason: unknown) => {
        if (
          reason instanceof AtlasLoaderError &&
          reason.code === "aborted"
        ) {
          return;
        }
        setBundleError(
          reason instanceof Error
            ? reason.message
            : "Selected anatomy could not be loaded.",
        );
      })
      .finally(() => {
        if (requestId.current === nextRequestId) setSwitchingBundle(false);
      });
  }, [deliveryMode, loader]);

  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = loader.subscribe(setLoaderState);
    void loader
      .loadCatalog({ signal: controller.signal })
      .then((loadedCatalog) => {
        setCatalog(loadedCatalog);
        return loader.loadSystem(INITIAL_SYSTEM_ID, {
          signal: controller.signal,
        });
      })
      .then((initialBundle) => {
        setBundles([initialBundle]);
        setActiveSystemIds([INITIAL_SYSTEM_ID]);
      })
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

  useEffect(() => () => activeController.current?.abort(), []);

  if (!catalog || bundles.length === 0) {
    return (
      <AtlasLoadScreen
        state={loaderState}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  return (
    <LoadedAnatomyExplorer
      bundles={bundles}
      systems={catalog.systems}
      activeSystemIds={activeSystemIds}
      deliveryMode={deliveryMode}
      switchingBundle={switchingBundle}
      bundleError={bundleError}
      onSystemsChange={loadSystems}
    />
  );
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
    ? "Loading anatomy overview"
    : state.status === "catalog-ready"
      ? "Preparing anatomy overview"
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
            <img src="/favicon.svg" alt="" />
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

function LoadedAnatomyExplorer({
  bundles,
  systems,
  activeSystemIds,
  deliveryMode,
  switchingBundle,
  bundleError,
  onSystemsChange,
}: {
  bundles: readonly LoadedAtlasBundle[];
  systems: AtlasCatalog["systems"];
  activeSystemIds: readonly string[];
  deliveryMode: SystemLoadMode;
  switchingBundle: boolean;
  bundleError: string | null;
  onSystemsChange: (
    systemIds: readonly string[],
    mode?: SystemLoadMode,
  ) => void;
}) {
  const anatomy = useMemo<AnatomyData>(
    () => createAnatomyData(bundles),
    [bundles],
  );
  const {
    registry: anatomyRegistry,
    byId: anatomyById,
    hierarchy: anatomyHierarchy,
    mappedNodeCount: atlasMappedNodeCount,
  } = anatomy;
  const initialLayers = useMemo(
    () => [...activeSystemIds],
    [activeSystemIds],
  );
  const viewer = useVanatomeController(initialLayers);
  const [query, setQuery] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileNavigationPanel, setMobileNavigationPanel] =
    useState<MobileNavigationPanel>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(anatomyHierarchy.map((structure) => structure.id)),
  );
  const selected = viewer.selectedId ? anatomyById[viewer.selectedId] : null;
  const selectedIsolationActive =
    viewer.isolation?.id === selected?.id;
  const rightPanelExpanded = isCompact ? mobilePanelOpen : rightOpen;
  const scanLabel = activeSystemIds.length === systems.length
    ? "FULL BODY SCAN"
    : activeSystemIds.length === 1
      ? `${systems.find((system) => system.id === activeSystemIds[0])?.name ?? "SYSTEM"} SCAN`
      : `${activeSystemIds.length} SYSTEMS SCAN`;
  const syncVisibleLayers = viewer.setVisibleLayers;

  useEffect(() => {
    syncVisibleLayers(activeSystemIds);
  }, [activeSystemIds, syncVisibleLayers]);

  useEffect(() => {
    const compactMedia = window.matchMedia("(max-width: 980px)");
    const phoneMedia = window.matchMedia("(max-width: 680px)");
    const update = () => {
      setIsCompact(compactMedia.matches);
      setIsPhone(phoneMedia.matches);
      if (!phoneMedia.matches) setMobileNavigationPanel(null);
    };
    update();
    compactMedia.addEventListener("change", update);
    phoneMedia.addEventListener("change", update);
    return () => {
      compactMedia.removeEventListener("change", update);
      phoneMedia.removeEventListener("change", update);
    };
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visibleStructures = anatomyRegistry.filter((organ) =>
      activeSystemIds.includes(organ.layer),
    );
    if (!needle) return visibleStructures;
    return visibleStructures.filter(
      (organ) =>
        organ.name.toLowerCase().includes(needle) ||
        organ.system.toLowerCase().includes(needle),
    );
  }, [activeSystemIds, anatomyRegistry, query]);

  const visibleHierarchy = useMemo(
    () => anatomyHierarchy.filter((structure) =>
      activeSystemIds.includes(structure.layer),
    ),
    [activeSystemIds, anatomyHierarchy],
  );

  const choose = (id: string | null) => {
    setContextMenu(null);
    const structure = id ? anatomyById[id] : null;
    if (
      structure &&
      !activeSystemIds.includes(structure.layer)
    ) {
      const nextSystems = [...activeSystemIds, structure.layer];
      onSystemsChange(nextSystems);
    }
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
    if (isPhone) {
      setMobileNavigationPanel(null);
      setMobilePanelOpen(false);
    } else {
      setMobilePanelOpen(true);
    }
    setQuery("");
  };

  const openStructureMenu = (event: VanatomeContextMenuEvent) => {
    const menuWidth = 280;
    const menuHeight = 280;
    setContextMenu({
      id: event.id,
      x: Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(event.clientY, window.innerHeight - menuHeight - 12)),
    });
  };

  const applyIsolation = (mode: VanatomeIsolationMode) => {
    if (!contextMenu) return;
    viewer.isolate(contextMenu.id, mode);
    setContextMenu(null);
  };

  const openSelectedViewOptions = () => {
    if (!selected) return;
    setMobilePanelOpen(false);
    setContextMenu({ id: selected.id, x: 0, y: 0 });
  };

  const resetViewer = () => {
    setContextMenu(null);
    viewer.reset();
  };

  const toggleSystem = (layerId: string) => {
    const active = activeSystemIds.includes(layerId);
    if (active && activeSystemIds.length === 1) return;
    if (active && selected?.layer === layerId) viewer.clear();
    const nextSystems = active
      ? activeSystemIds.filter((candidate) => candidate !== layerId)
      : [...activeSystemIds, layerId];
    onSystemsChange(nextSystems);
  };

  const showAllSystems = () => {
    const allSystems = systems.map((system) => system.id);
    onSystemsChange(allSystems, "full-body");
  };

  const menuStructure = contextMenu ? anatomyById[contextMenu.id] : null;
  const menuParent = menuStructure?.parentId
    ? anatomyById[menuStructure.parentId]
    : null;

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

  const toggleMobileNavigation = (
    panel: Exclude<MobileNavigationPanel, null>,
  ) => {
    setMobilePanelOpen(false);
    setMobileNavigationPanel((current) =>
      current === panel ? null : panel,
    );
  };

  const toggleMobileDetails = () => {
    setMobileNavigationPanel(null);
    setRightOpen(true);
    setMobilePanelOpen((open) => !open);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src="/favicon.svg" alt="" />
          </div>
          <div>
            <div className="brand-name">Vanatome</div>
            <div className="brand-subtitle">HUMAN SYSTEMS ATLAS</div>
          </div>
        </div>

        <div className="status-pill">
          <span className="status-dot" />
          {activeSystemIds.length === systems.length
            ? "FULL BODY ONLINE"
            : `${activeSystemIds.length} ${
              activeSystemIds.length === 1 ? "SYSTEM" : "SYSTEMS"
            } ACTIVE`}
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
        {(leftOpen || isPhone) && (
          <aside
            id="anatomy-browser"
            className={`left-rail ${
              mobileNavigationPanel
                ? `mobile-browser-open mobile-mode-${mobileNavigationPanel}`
                : ""
            }`}
            aria-label="Anatomy structure browser"
            aria-hidden={
              isPhone && !mobileNavigationPanel ? true : undefined
            }
            inert={
              isPhone && !mobileNavigationPanel ? true : undefined
            }
          >
            <div className="mobile-sheet-header">
              <div>
                <span className="mobile-sheet-kicker">
                  {mobileNavigationPanel === "systems"
                    ? "DISPLAY FILTER"
                    : "ANATOMY INDEX"}
                </span>
                <strong>
                  {mobileNavigationPanel === "systems"
                    ? "Choose systems"
                    : "Browse anatomy"}
                </strong>
              </div>
              <button
                type="button"
                aria-label="Close anatomy browser"
                onClick={() => setMobileNavigationPanel(null)}
              >
                <X size={18} />
              </button>
            </div>

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

            <div className="layer-controls" aria-label="Anatomy systems">
              <div className="layer-heading">
                <span className="layer-label">
                  <Layers3 size={13} />
                  SYSTEMS · MULTI SELECT
                </span>
                <button
                  type="button"
                  className="layer-reset"
                  onClick={showAllSystems}
                  disabled={activeSystemIds.length === systems.length}
                >
                  ALL
                </button>
              </div>
              <div className="layer-chips">
                {systems.map((system) => {
                  const active = activeSystemIds.includes(system.id);
                  const lastActive =
                    active && activeSystemIds.length === 1;
                  return (
                    <button
                      key={system.id}
                      type="button"
                      className={`layer-chip ${active ? "active" : ""}`}
                      aria-pressed={active}
                      aria-disabled={lastActive}
                      title={lastActive
                        ? "At least one system must remain visible"
                        : `${active ? "Hide" : "Show"} ${system.name}`}
                      onClick={() => toggleSystem(system.id)}
                    >
                      {system.name}
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
                : visibleHierarchy.map((structure, index) =>
                    renderStructure(structure, index),
                  )}
              {matches.length === 0 && (
                <div className="empty-search">
                  {query
                    ? `No structures match “${query}”.`
                    : "No selectable structures in this view."}
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
            atlases={anatomy.atlases}
            selectedId={viewer.selectedId}
            isolation={viewer.isolation}
            visibleLayers={viewer.visibleLayers}
            focusRequestKey={viewer.focusRequestKey}
            resetViewKey={viewer.resetViewKey}
            onSelect={choose}
            onStructureContextMenu={openStructureMenu}
            onEscape={() => {
              if (contextMenu) setContextMenu(null);
              else viewer.clear();
            }}
          />

          {switchingBundle && (
            <div className="bundle-switching" role="status">
              <div className="scanner-ring" aria-hidden="true" />
              <span>LOADING SELECTED ANATOMY</span>
            </div>
          )}
          {bundleError && !switchingBundle && (
            <div className="bundle-switching bundle-error" role="alert">
              <span>{bundleError}</span>
            </div>
          )}

          <div className="viewer-label">
            <span className="eyebrow">
              {selected ? "SELECTED STRUCTURE" : scanLabel}
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
            onClick={resetViewer}
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
            <span><Move size={15} /> RIGHT-DRAG TO MOVE</span>
            <span className="touch-move-hint">
              <Move size={15} /> TOUCH: ROTATE • PINCH/PAN
            </span>
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
            aria-hidden={
              isCompact && !mobilePanelOpen ? true : undefined
            }
            inert={
              isCompact && !mobilePanelOpen ? true : undefined
            }
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
                    className={`panel-action ${viewer.isolation ? "active" : ""}`}
                    aria-pressed={selectedIsolationActive}
                    onClick={() =>
                      viewer.isolate(
                        selectedIsolationActive ? null : selected.id,
                      )
                    }
                  >
                    {selectedIsolationActive ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                    {selectedIsolationActive ? "SHOW ALL" : "ISOLATE"}
                  </button>
                  <button
                    type="button"
                    className="panel-action"
                    onClick={() => viewer.focus(selected.id)}
                  >
                    <Crosshair size={15} />
                    FOCUS
                  </button>
                  <button
                    type="button"
                    className="panel-action mobile-view-options"
                    onClick={openSelectedViewOptions}
                  >
                    <Layers3 size={15} />
                    VIEW OPTIONS
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
        {isPhone && mobileNavigationPanel && (
          <button
            className="mobile-nav-backdrop"
            type="button"
            aria-label="Close mobile navigation"
            onClick={() => setMobileNavigationPanel(null)}
          />
        )}

        {contextMenu && menuStructure && (
          <div
            className="viewer-context-dismiss"
            onPointerDown={() => setContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setContextMenu(null);
            }}
          >
            <div
              className="viewer-context-menu"
              role="menu"
              aria-label={`${menuStructure.name} view options`}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="viewer-context-heading">
                <div>
                  <span>VIEW OPTIONS</span>
                  <strong>{menuStructure.name}</strong>
                </div>
                <button
                  type="button"
                  className="viewer-context-close"
                  aria-label="Close view options"
                  onClick={() => setContextMenu(null)}
                >
                  <X size={17} />
                </button>
              </div>
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={() => applyIsolation("selected")}
              >
                <strong>Isolate structure</strong>
                <span>Show only {menuStructure.name}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!menuParent}
                onClick={() => applyIsolation("parent")}
              >
                <strong>Isolate within parent</strong>
                <span>
                  {menuParent
                    ? `Keep the complete ${menuParent.name} visible`
                    : "No parent structure is available"}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!menuParent}
                onClick={() => applyIsolation("parent-context")}
              >
                <strong>Parent as translucent context</strong>
                <span>
                  {menuParent
                    ? `Ghost ${menuParent.name} around the selection`
                    : "No parent structure is available"}
                </span>
              </button>
              {viewer.isolation && (
                <button
                  type="button"
                  role="menuitem"
                  className="viewer-context-reset"
                  onClick={() => {
                    viewer.isolate(null);
                    setContextMenu(null);
                  }}
                >
                  <strong>Show all anatomy</strong>
                  <span>Exit the current isolation view</span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <nav className="mobile-dock" aria-label="Mobile anatomy navigation">
        <button
          type="button"
          className={mobileNavigationPanel === "browse" ? "active" : ""}
          aria-pressed={mobileNavigationPanel === "browse"}
          onClick={() => toggleMobileNavigation("browse")}
        >
          <Search size={18} />
          <span>BROWSE</span>
        </button>
        <button
          type="button"
          className={mobileNavigationPanel === "systems" ? "active" : ""}
          aria-pressed={mobileNavigationPanel === "systems"}
          onClick={() => toggleMobileNavigation("systems")}
        >
          <Layers3 size={18} />
          <span>SYSTEMS</span>
          <i>{activeSystemIds.length}</i>
        </button>
        <button
          type="button"
          className={mobilePanelOpen ? "active" : ""}
          aria-pressed={mobilePanelOpen}
          onClick={toggleMobileDetails}
        >
          <Info size={18} />
          <span>DETAILS</span>
          {selected && <i className="selection-indicator" />}
        </button>
      </nav>

      <footer className="footer">
        <span>
          Z-ANATOMY MODEL • {atlasMappedNodeCount} MAPPED NODES • {deliveryMode === "full-body"
            ? "FULL-BODY CACHE"
            : "SELECTIVE BUNDLES"}
        </span>
        <a href={anatomy.attributionUrl} target="_blank" rel="noreferrer">
          OPEN MODEL ATTRIBUTION
        </a>
      </footer>
    </main>
  );
}
