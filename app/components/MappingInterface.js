'use client';

import { useState } from 'react';

export default function MappingInterface({ workbookData = [], templateData = [], onGenerateTemplate }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [mappings, setMappings] = useState({});
  const [activeSelect, setActiveSelect] = useState(null);

  const handleMapping = (templateField, value) => {
    if (!templateData || !templateData[activeSheet]) return;

    const templateSheetName = templateData[activeSheet].name;
    const templateKey = `${templateSheetName}|${templateField}`;

    if (!value) {
      const newMappings = { ...mappings };
      delete newMappings[templateKey];
      setMappings(newMappings);
      onGenerateTemplate(newMappings);
    } else {
      const newMappings = {
        ...mappings,
        [templateKey]: value
      };
      setMappings(newMappings);
      onGenerateTemplate(newMappings);
    }
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

  if (!templateData || templateData.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sheet Tabs */}
      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {templateData.map((sheet, index) => (
          <button
            key={sheet.name}
            onClick={() => setActiveSheet(index)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
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
            {templateData[activeSheet].headers.map((header, index) => {
              const templateField = header.field;
              const templateKey = `${templateData[activeSheet].name}|${templateField}`;
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