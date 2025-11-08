import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import * as Lucide from 'lucide-react';
import DynamicComponent from './DynamicComponent';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function GridContainer({
  components,
  onLayoutChange,
  openEditModal,
  onDeleteComponent,
  onToggleLock,
  placeholderLayout,
  onPlaceholderLayoutChange,
}) {
  const renderPlaceholder = () => (
    <div
      key="placeholder"
      className="bg-slate-800 rounded-lg border-2 border-dashed border-slate-500
                 flex items-center justify-center text-slate-500 cursor-move h-full w-full"
    >
      <div className="text-center">
        <Lucide.PlusCircle size={24} className="mx-auto" />
        <p className="font-medium">New Component</p>
        <p className="text-xs">Drag and resize me</p>
      </div>
    </div>
  );

  return (
    <ResponsiveGridLayout
      className="layout h-full min-h-full"
      layouts={{ lg: [...components.map((c) => c.layout), placeholderLayout] }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={100}
      onLayoutChange={(layout) => {
        const realComponentLayouts = layout.filter((l) => l.i !== 'placeholder');
        const placeholder = layout.find((l) => l.i === 'placeholder');

        onLayoutChange(realComponentLayouts);
        onPlaceholderLayoutChange(placeholder);
      }}
      draggableCancel=".no-drag"
      compactType={null}
      preventCollision={true}
    >
      {components.map((comp) => (
        <div
          key={comp.id}
          data-grid={{
            ...comp.layout,
            isDraggable: !comp.isLocked,
            isResizable: !comp.isLocked,
          }}
          className={`relative group bg-gray-700 rounded-lg ring-1 ring-gray-600 shadow-lg
                      ${comp.isLocked ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="h-full w-full">
            <DynamicComponent code={comp.code} />
          </div>

          <div
            className="absolute top-2 right-2 z-10
                       opacity-0 group-hover:opacity-100
                       transition-opacity"
          >
            <div className="flex gap-1 no-drag pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(comp.id);
                }}
                className={`p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:text-white transition-colors
                           ${comp.isLocked ? 'hover:bg-blue-500' : 'hover:bg-yellow-600'}`}
                title={comp.isLocked ? 'Unlock' : 'Lock'}
              >
                {comp.isLocked ? <Lucide.Unlock size={16} /> : <Lucide.Lock size={16} />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(comp);
                }}
                className="p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:bg-blue-600 hover:text-white transition-colors"
                title="Edit Component"
              >
                <Lucide.Pencil size={16} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteComponent(comp.id);
                }}
                className="p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:bg-red-600 hover:text-white transition-colors"
                title="Delete Component"
              >
                <Lucide.Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}

      <div key="placeholder" data-grid={placeholderLayout}>
        {renderPlaceholder()}
      </div>
    </ResponsiveGridLayout>
  );
}
