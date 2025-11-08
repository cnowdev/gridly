import React, { useRef, useState, useEffect } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import {
  X,
  PlusCircle,
  Unlock,
  Lock,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import DynamicComponent from "./DynamicComponent";
import { createPortal } from "react-dom";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function GridContainer({
  components,
  onLayoutChange,
  openEditModal,
  onDeleteComponent,
  onToggleLock,
  placeholderLayout,
  showPlaceholder,
  onCancelPlaceholder,
  onDuplicateComponent,
}) {
  const itemRefs = useRef({});
  const [portalControls, setPortalControls] = useState(null);

  useEffect(() => {
    const onScrollOrResize = () => {
      // Reposition portal if visible
      if (portalControls && portalControls.compId) {
        const node = itemRefs.current[portalControls.compId];
        if (node) {
          const rect = node.getBoundingClientRect();
          setPortalControls((p) => (p ? { ...p, rect } : p));
        }
      }
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [portalControls]);

  const showPortalFor = (comp) => {
    const node = itemRefs.current[comp.id];
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setPortalControls({ compId: comp.id, rect, comp, visible: true });
  };

  const hidePortal = () => setPortalControls(null);

  const renderPlaceholder = (layout) => {
    // treat placeholder as "small" when its height is less than 4 to match components
    const isSmall = layout.h < 4;

    return (
      <div
        key="placeholder"
        className={
          "relative bg-slate-800 rounded-lg border-2 border-dashed border-slate-500 " +
          "flex items-center justify-center text-slate-500 cursor-move h-full w-full overflow-hidden"
        }
      >
        {/* internal cancel X (keep only for larger placeholders) */}
        {!isSmall && (
          <div className="no-drag absolute top-2 right-2 z-[9999] pointer-events-auto">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancelPlaceholder();
              }}
              className="p-0.5 bg-gray-900/90 text-slate-300 rounded-md hover:bg-red-600 hover:text-white transition-colors border border-slate-600"
              title="Cancel placeholder"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="text-center select-none">
          <PlusCircle size={isSmall ? 24 : 32} className="mx-auto" />
          {!isSmall && (
            <>
              <p className="font-medium mt-1">New Component</p>
              <p className="text-xs">Drag and resize me</p>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveGridLayout
      className="layout h-full min-h-full"
      layouts={{
        lg: [
          ...components.map((c) => c.layout),
          ...(showPlaceholder ? [placeholderLayout] : []),
        ],
      }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={20}
      onLayoutChange={onLayoutChange}
      draggableCancel=".no-drag"
      compactType={null}
      preventCollision={true}
      margin={[0, 0]}
      containerPadding={[0, 0]}
    >
      {components.map((comp) => {
        const isSmallComponent = comp.layout.h < 4;

        return (
          <div
            key={comp.id}
            data-grid={{
              ...comp.layout,
              isDraggable: !comp.isLocked,
              isResizable: !comp.isLocked,
            }}
            ref={(el) => {
              itemRefs.current[comp.id] = el;
            }}
            onMouseEnter={() => showPortalFor(comp)}
            onMouseLeave={() => hidePortal()}
            className={`relative group bg-gray-700 rounded-lg ring-1 ring-gray-600 shadow-lg overflow-visible ${
              comp.isLocked ? "ring-2 ring-blue-500" : ""
            } transition-all duration-150 will-change-transform transform-gpu hover:z-[9999]`}
          >
            <div className="h-full w-full transform-style-preserve-3d">
              <DynamicComponent code={comp.code} />
            </div>

            {!comp.isLocked && <div className="absolute inset-0 z-10" />}

            {/* === Control Cluster === */}
            {isSmallComponent ? (
              <div className="absolute -top-3 -right-3 z-[100000] opacity-0 group-hover:opacity-100 transition-all duration-150 transform-gpu pointer-events-none group-hover:pointer-events-auto">
                <div className="flex gap-1 bg-gray-900/90 px-1.5 py-1 rounded-md shadow-lg ring-1 ring-slate-600 items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(comp.id);
                    }}
                    title={comp.isLocked ? "Unlock" : "Lock"}
                    className={`p-0.5 rounded-md text-white hover:text-white transition-colors ${
                      comp.isLocked
                        ? "hover:bg-blue-500"
                        : "hover:bg-yellow-600"
                    }`}
                  >
                    {comp.isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(comp);
                    }}
                    title="Edit Component"
                    className="p-0.5 rounded-md text-white hover:bg-blue-600 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateComponent(comp.id);
                    }}
                    title="Duplicate Component"
                    className="p-0.5 rounded-md text-white hover:bg-green-600 transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteComponent(comp.id);
                    }}
                    title="Delete Component"
                    className="p-0.5 rounded-md text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute top-2 right-2 z-[100000] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                <div className="flex gap-1 bg-gray-900/90 px-2 py-1 rounded-md shadow-md ring-1 ring-slate-600 items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(comp.id);
                    }}
                    className={`p-1 text-white rounded-md hover:text-white transition-colors ${
                      comp.isLocked
                        ? "hover:bg-blue-500"
                        : "hover:bg-yellow-600"
                    }`}
                    title={comp.isLocked ? "Unlock" : "Lock"}
                  >
                    {comp.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(comp);
                    }}
                    className="p-1 text-white rounded-md hover:bg-blue-600 transition-colors"
                    title="Edit Component"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateComponent(comp.id);
                    }}
                    className="p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:bg-green-600 hover:text-white transition-colors"
                    title="Duplicate Component"
                  >
                    <Copy size={16} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteComponent(comp.id);
                    }}
                    className="p-1 text-white rounded-md hover:bg-red-600 transition-colors"
                    title="Delete Component"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showPlaceholder && (
        <div
          key="placeholder"
          data-grid={placeholderLayout}
          className="overflow-visible group relative"
        >
          {renderPlaceholder(placeholderLayout)}

          {/* If placeholder is short, show an external cancel button to match small-component UX (hidden until hover) */}
          {placeholderLayout.h < 4 && (
            <div className="absolute -top-3 -right-3 z-50 opacity-0 group-hover:opacity-100 transition-all duration-150 transform-gpu pointer-events-none group-hover:pointer-events-auto">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancelPlaceholder();
                }}
                className="p-0.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-all duration-150 shadow-sm ring-1 ring-red-300"
                title="Cancel placeholder"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </ResponsiveGridLayout>
  );
}
