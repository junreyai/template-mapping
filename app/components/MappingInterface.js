'use client';

import React, { useState, useEffect } from 'react';

export default function MappingInterface({ workbookData = [], templateData = [], onGenerateTemplate }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [mappings, setMappings] = useState({});
  const [activeSelect, setActiveSelect] = useState(null);

  const findSimilarField = (templateField) => {
    if (!workbookData || workbookData.length === 0) return null;

    // Clean up the field name for comparison
    const cleanField = templateField.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Search through all sheets
    for (const sheet of workbookData) {
      for (const header of sheet.headers) {
        const cleanHeader = header.field.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanField === cleanHeader) {
          return `${sheet.name}|${header.field}`;
        }
      }
    }
    return null;
  };

  const findMatchingSourceField = (templateField) => {
    for (const sheet of workbookData) {
      const matchingHeader = sheet.headers.find(header => 
        header.field.toLowerCase().trim() === templateField.toLowerCase().trim()
      );
      if (matchingHeader) {
        return `${sheet.name}|${matchingHeader.field}`;
      }
    }
    return '';
  };

  // Reset activeSheet when workbookData changes
  useEffect(() => {
    setActiveSheet(0);
  }, [workbookData]);

  // Auto-map fields when workbookData changes
  useEffect(() => {
    if (!workbookData || workbookData.length === 0 || !templateData || !templateData[0]) return;

    const currentSheet = workbookData[activeSheet];
    if (!currentSheet) return;

    // Check if we already have mappings for this sheet
    const hasExistingMappings = currentSheet.headers.some(header => {
      const templateKey = `${currentSheet.name}|${header.field}`;
      return mappings[templateKey];
    });

    // Only perform auto-mapping if there are no existing mappings
    if (!hasExistingMappings) {
      const newMappings = { ...mappings };
      let hasAddedMapping = false;
      
      currentSheet.headers.forEach(header => {
        const templateField = header.field;
        const templateKey = `${currentSheet.name}|${templateField}`;
        
        // Only map if not already mapped
        if (!newMappings[templateKey]) {
          const similarField = findSimilarField(templateField);
          if (similarField) {
            newMappings[templateKey] = similarField;
            hasAddedMapping = true;
          }
        }
      });

      if (hasAddedMapping) {
        setMappings(newMappings);
        // Notify parent component about the new mappings
        onGenerateTemplate(newMappings);
      }
    }
  }, [workbookData, activeSheet, findSimilarField, templateData, mappings, onGenerateTemplate]);

  useEffect(() => {
    if (templateData && workbookData && workbookData.length > 0) {
      const newMappings = { ...mappings };
      let hasNewMappings = false;

      templateData.forEach(templateSheet => {
        templateSheet.headers.forEach(header => {
          const templateKey = `${templateSheet.name}|${header.field}`;
          // Only auto-map if no mapping exists
          if (!mappings[templateKey]) {
            const matchingSource = findMatchingSourceField(header.field);
            if (matchingSource) {
              newMappings[templateKey] = matchingSource;
              hasNewMappings = true;
            }
          }
        });
      });

      if (hasNewMappings) {
        setMappings(newMappings);
        onGenerateTemplate(newMappings);
      }
    }
  }, [templateData, workbookData]);

  const handleMapping = (templateSheet, templateField, value) => {
    const templateKey = `${templateSheet}|${templateField}`;
    const newMappings = { ...mappings };

    if (!value) {
      delete newMappings[templateKey];
    } else {
      newMappings[templateKey] = value;
    }
    
    setMappings(newMappings);
    // Notify parent component about the mapping change
    onGenerateTemplate(newMappings);
  };

  const getSelectedSourceFields = () => {
    const selectedFields = new Set();
    Object.values(mappings).forEach(value => {
      if (value) {
        selectedFields.add(value);
      }
    });
    return selectedFields;
  };

  const getSheetHasMappings = (sheetName) => {
    return Object.keys(mappings).some(key => key.startsWith(`${sheetName}|`));
  };

  if (!workbookData || workbookData.length === 0 || !templateData || templateData.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Source Sheet Tabs */}
      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {workbookData.map((sheet, index) => (
          <button
            key={sheet.name}
            onClick={() => setActiveSheet(index)}
            className={`px-4 py-2 rounded-t-lg text-sm whitespace-nowrap ${
              index === activeSheet
                ? 'bg-[#64afec] text-white'
                : getSheetHasMappings(sheet.name)
                  ? 'bg-blue-100 text-[#64afec]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {sheet.name}
          </button>
        ))}
      </div>

      {/* Mapping Table */}
      <div className="flex-grow overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 w-1/2">Template Fields</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 w-1/2">Source Fields</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {templateData.map((templateSheet, sheetIndex) => (
              <React.Fragment key={templateSheet.name}>
                {/* Template Sheet Header */}
                <tr className="bg-gray-50">
                  <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-700">
                    Sheet: {templateSheet.name}
                  </td>
                </tr>
                {/* Template Fields */}
                {templateSheet.headers.map((header, fieldIndex) => {
                  const templateField = header.field;
                  const templateKey = `${templateSheet.name}|${templateField}`;
                  const selectedValue = mappings[templateKey];
                  const selectedFields = getSelectedSourceFields();

                  return (
                    <tr key={`${templateSheet.name}-${fieldIndex}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900 w-1/2">
                        <div className="flex items-center">
                          <span className="truncate">{templateField}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 w-1/2">
                        <div className="flex items-center">
                          <select
                            value={selectedValue || ''}
                            onChange={(e) => handleMapping(templateSheet.name, templateField, e.target.value)}
                            onFocus={() => setActiveSelect(templateKey)}
                            onBlur={() => setActiveSelect(null)}
                            className={`
                              w-full p-2.5 text-sm
                              bg-white border rounded-lg
                              shadow-sm transition-all duration-200
                              hover:border-blue-300
                              focus:ring-2 focus:ring-blue-200 focus:border-[#64afec]
                              appearance-none
                              bg-[url('data:image/svg+xml;charset=US-ASCII,<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10L12 15L17 10" stroke="%236B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')] 
                              bg-no-repeat bg-right-1 bg-[length:20px] pr-10
                              ${activeSelect === templateKey ? 'border-[#64afec] ring-2 ring-blue-200' : 'border-gray-300'}
                            `}
                          >
                            <option value="" className="text-gray-500 italic">Select a field</option>
                            {workbookData.map(sheet => (
                              <optgroup 
                                key={sheet.name} 
                                label={sheet.name}
                                className="font-semibold bg-gray-50"
                              >
                                {sheet.headers.map((sourceHeader, idx) => {
                                  const value = `${sheet.name}|${sourceHeader.field}`;
                                  const isMatch = templateField.toLowerCase().trim() === sourceHeader.field.toLowerCase().trim();
                                  return (
                                    <option
                                      key={idx}
                                      value={value}
                                      disabled={selectedFields.has(value) && value !== selectedValue}
                                      className={`
                                        py-2 px-4
                                        ${isMatch ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'}
                                        ${selectedFields.has(value) && value !== selectedValue ? 'text-gray-400' : ''}
                                      `}
                                    >
                                      {sourceHeader.field}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}