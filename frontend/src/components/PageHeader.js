import React from 'react';

const PageHeader = ({ title, subtitle, left, actions }) => (
  <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        {left && <div className="flex items-center gap-3">{left}</div>}
        <div className="flex-1 min-w-0">
          {title && <h1 className="text-xl font-bold truncate">{title}</h1>}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  </header>
);

export default PageHeader;
