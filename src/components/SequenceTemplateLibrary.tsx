import React, { useState, useMemo } from 'react';
import { LazyIcon } from '@/components/icons';
import type { SequenceTemplate } from '@/types/emailSequence';
import { SEQUENCE_TEMPLATES } from '@/services/EmailSequenceService';
import { MANIFEST_SEQUENCES } from '@/data/sequenceTemplates';

interface SequenceTemplateLibraryProps {
  onSelect: (template: SequenceTemplate) => void;
  onClose: () => void;
}

export function SequenceTemplateLibrary({ onSelect, onClose }: SequenceTemplateLibraryProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allTemplates = useMemo(() => {
    return [...MANIFEST_SEQUENCES, ...SEQUENCE_TEMPLATES];
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(allTemplates.map(t => t.category || 'other'));
    return ['all', ...Array.from(cats)];
  }, [allTemplates]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                          t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allTemplates, search, selectedCategory]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sequence Library</h2>
            <p className="text-sm text-gray-500 mt-1">Choose a proven template to get started</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <LazyIcon name="X" className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b flex gap-4 items-center bg-white">
          <div className="relative flex-1 max-w-md">
            <LazyIcon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <div 
                key={template.id}
                onClick={() => onSelect(template)}
                className="group bg-white p-5 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                    template.category === 'manifest_outreach' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {template.category?.replace(/_/g, ' ') || 'Template'}
                  </span>
                  {template.avgReplyRate && (
                    <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <LazyIcon name="TrendingUp" className="w-3 h-3 mr-1" />
                      {template.avgReplyRate}% Reply
                    </span>
                  )}
                </div>
                
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                  {template.description}
                </p>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center">
                      <LazyIcon name="List" className="w-3 h-3 mr-1" />
                      {template.steps.length} Steps
                    </span>
                    {template.persona && (
                      <span className="flex items-center capitalize">
                        <LazyIcon name="User" className="w-3 h-3 mr-1" />
                        {template.persona.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    Use Template <LazyIcon name="ArrowRight" className="w-3 h-3 ml-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <LazyIcon name="FileQuestion" className="w-12 h-12 mb-3 opacity-20" />
              <p>No templates found matching "{search}"</p>
              <button 
                onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                className="mt-2 text-blue-600 text-sm hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
