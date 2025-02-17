'use client';

import { useState, useEffect } from 'react';

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

  const handleMapping = (templateField, value) => {
    if (!workbookData || !workbookData[activeSheet]) return;

    const currentSheet = workbookData[activeSheet];
    const templateKey = `${currentSheet.name}|${templateField}`;

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

  if (!workbookData || workbookData.length === 0) {
    return null;
  }

  const currentSheet = workbookData[activeSheet];
  if (!currentSheet) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sheet Tabs */}
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
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Template Fields</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Source Fields</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentSheet.headers.map((header, index) => {
              const templateField = header.field;
              const templateKey = `${currentSheet.name}|${templateField}`;
              const selectedValue = mappings[templateKey];
              const selectedFields = getSelectedSourceFields();

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">{templateField}</td>
                  <td className="px-4 py-2">
                    <select
                      value={selectedValue || ''}
                      onChange={(e) => handleMapping(templateField, e.target.value)}
                      onFocus={() => setActiveSelect(templateKey)}
                      onBlur={() => setActiveSelect(null)}
                      className={`w-full p-2 text-sm border rounded-lg ${
                        activeSelect === templateKey ? 'border-[#64afec]' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a field</option>
                      {workbookData.map(sheet => (
                        <optgroup key={sheet.name} label={sheet.name}>
                          {sheet.headers.map((sourceHeader, idx) => {
                            const value = `${sheet.name}|${sourceHeader.field}`;
                            return (
                              <option
                                key={idx}
                                value={value}
                                disabled={selectedFields.has(value) && value !== selectedValue}
                              >
                                {sourceHeader.field}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}