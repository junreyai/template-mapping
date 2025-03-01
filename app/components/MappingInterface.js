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

  const hasMatchingSourceField = (templateField) => {
    return workbookData.some(sheet => 
      sheet.headers.some(header => 
        header.field.toLowerCase().trim() === templateField.toLowerCase().trim()
      )
    );
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

    // Only perform auto-mapping if there are no existing mappings
    const hasExistingMappings = Object.keys(mappings).length > 0;
    if (!hasExistingMappings) {
      const newMappings = {};
      const usedSourceFields = new Set();

      // Iterate through template fields first to maintain sequence
      templateData.forEach(templateSheet => {
        templateSheet.headers.forEach(header => {
          const templateKey = `${templateSheet.name}|${header.field}`;
          
          // Find matching source field that hasn't been used
          for (const sourceSheet of workbookData) {
            const matchingHeader = sourceSheet.headers.find(sourceHeader => 
              !usedSourceFields.has(`${sourceSheet.name}|${sourceHeader.field}`) &&
              sourceHeader.field.toLowerCase().trim() === header.field.toLowerCase().trim()
            );
            
            if (matchingHeader) {
              const sourceValue = `${sourceSheet.name}|${matchingHeader.field}`;
              newMappings[templateKey] = sourceValue;
              usedSourceFields.add(sourceValue);
              break;
            }
          }
        });
      });

      if (Object.keys(newMappings).length > 0) {
        setMappings(newMappings);
        onGenerateTemplate(newMappings);
      }
    }
  }, [workbookData, activeSheet, templateData, mappings, onGenerateTemplate]);

  useEffect(() => {
    if (templateData && workbookData && workbookData.length > 0) {
      const newMappings = { ...mappings };
      let hasNewMappings = false;
      const usedSourceFields = new Set(
        Object.values(mappings).map(mapping => mapping)
      );

      // Iterate through template fields to maintain sequence
      templateData.forEach(templateSheet => {
        templateSheet.headers.forEach(header => {
          const templateKey = `${templateSheet.name}|${header.field}`;
          
          // Only auto-map if no mapping exists
          if (!mappings[templateKey]) {
            // Try to find exact match first
            let matchingSource = findMatchingSourceField(header.field);
            
            if (matchingSource && !usedSourceFields.has(matchingSource)) {
              newMappings[templateKey] = matchingSource;
              usedSourceFields.add(matchingSource);
              hasNewMappings = true;
            } else {
              // Try to find similar field if no exact match
              matchingSource = findSimilarField(header.field);
              if (matchingSource && !usedSourceFields.has(matchingSource)) {
                newMappings[templateKey] = matchingSource;
                usedSourceFields.add(matchingSource);
                hasNewMappings = true;
              }
            }
          }
        });
      });

      if (hasNewMappings) {
        setMappings(newMappings);
        onGenerateTemplate(newMappings);
      }
    }
  }, [templateData, workbookData, mappings, findMatchingSourceField, findSimilarField, onGenerateTemplate]);

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
      {/* Mapping Table */}
      <div className="flex-grow overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left w-1/2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Template Fields</span>
                  <span className="text-xs text-gray-400 mt-1">Sheet: {templateData[0].name}</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left w-1/2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500">Source Fields</span>
                  <span className="text-xs text-gray-400 mt-1">Sheet: {workbookData[activeSheet]?.name}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {templateData.map((templateSheet, sheetIndex) => (
              <React.Fragment key={templateSheet.name}>
                {/* Template Sheet Header */}
                <tr className="bg-gray-50">
                </tr>
                {/* Template Fields */}
                {templateSheet.headers.map((header, fieldIndex) => {
                  const templateField = header.field;
                  const templateKey = `${templateSheet.name}|${templateField}`;
                  const selectedValue = mappings[templateKey];
                  const selectedFields = getSelectedSourceFields();

                  return (
                    <tr key={`${templateSheet.name}-${fieldIndex}`} className="hover:bg-gray-50">
                      <td className={`px-4 py-2 text-sm w-1/2 ${hasMatchingSourceField(templateField) ? 'bg-green-50 text-green-600' : 'text-gray-900'}`}>
                        <div className="flex items-center">
                          <span className="truncate">{templateField}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2 w-1/2 ${hasMatchingSourceField(templateField) ? 'bg-green-50' : ''}`}>
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
                              ${hasMatchingSourceField(templateField) ? 'text-green-600' : ''}
                            `}
                          >
                            <option value="" className="text-gray-500 italic">Select a field</option>
                            {workbookData.map(sheet => (
                              <optgroup 
                                key={sheet.name} 
                                label={sheet.name}
                                className="font-semibold bg-gray-50 text-gray-700"
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
                                        ${isMatch ? 'text-green-600 font-medium bg-green-50' : 'text-gray-700'}
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