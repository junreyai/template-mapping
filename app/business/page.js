'use client';

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import toast from 'react-hot-toast';
import MappingInterface from '../components/MappingInterface';
import FileDropzone from '../components/FileDropzone';
import { supabase } from '@/lib/supabase';

export default function Business() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [workbookData, setWorkbookData] = useState(null);
  const [templateData, setTemplateData] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [mappings, setMappings] = useState({});
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [templateFiles, setTemplateFiles] = useState([]);

  // Load template from Supabase on component mount
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.storage
          .from('freetemplate')
          .download('business/business.xlsx');

        if (error) {
          throw error;
        }

        // Convert blob to array buffer
        const arrayBuffer = await data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Read the template file
        const workbook = XLSX.read(uint8Array, { type: 'array' });
        
        // Process template sheets
        const sheets = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
          
          return {
            name,
            headers: headerRow.map(header => ({ field: header?.toString() || '' }))
              .filter(header => header.field.trim() !== '')
          };
        }).filter(sheet => sheet.headers.length > 0);

        if (sheets.length === 0) {
          throw new Error('No valid headers found in template');
        }

        setTemplateFile({ name: 'business.xlsx', data: uint8Array });
        setTemplateData(sheets);
        setTemplateFiles([{ name: 'business.xlsx', data: uint8Array, id: 1 }]);
      } catch (error) {
        console.error('Error loading template:', error);
        toast.error('Error loading business template');
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, []);

  const handleFilesUpload = useCallback((files) => {
    if (files && files.length > 0) {
      const newFiles = files.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: Date.now() + Math.random(),
              name: file.name,
              type: file.type,
              data: reader.result,
              lastModified: file.lastModified
            });
          };
          reader.readAsArrayBuffer(file);
        });
      });

      Promise.all(newFiles).then(fileDataArray => {
        setUploadedFiles(prev => [...prev, ...fileDataArray]);
        toast.success(`Successfully uploaded ${fileDataArray.length} file(s)`);
      });
    }
  }, []);

  const handleSelectFile = (file) => {
    if (selectedFile && selectedFile.id === file.id) {
      setSelectedFile(null);
      setShowMapping(false);
      setWorkbookData(null);
      setMappings({});
    } else {
      setSelectedFile(file);
      setShowMapping(false);
      setWorkbookData(null);
      setMappings({});
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setUploadedFiles(files => files.filter((_, index) => index !== indexToRemove));
    if (selectedFile && uploadedFiles[indexToRemove]?.id === selectedFile.id) {
      setSelectedFile(null);
      setShowMapping(false);
      setWorkbookData(null);
      setMappings({});
    }
    toast.success('Source file removed');
  };

  const handleProcess = useCallback(async () => {
    if (!selectedFile || !templateFile) return;

    try {
      // Read the source file data
      const sourceWorkbook = XLSX.read(selectedFile.data, { type: 'array' });
      
      // Process all sheets
      const processedSheets = sourceWorkbook.SheetNames.map(sheetName => {
        const sourceSheet = sourceWorkbook.Sheets[sheetName];
        const sourceData = XLSX.utils.sheet_to_json(sourceSheet, { header: 1 });
        
        if (sourceData.length === 0) {
          return null;
        }

        // Get headers from first row
        const headers = sourceData[0].map(header => header?.toString() || '').filter(Boolean);
        
        return {
          name: sheetName,
          headers: headers.map(header => ({ field: header })),
          data: sourceData.slice(1)
        };
      }).filter(sheet => sheet !== null && sheet.headers.length > 0);
      
      if (processedSheets.length === 0) {
        toast.error('No valid data found in source file');
        return;
      }

      setWorkbookData(processedSheets);
      setShowMapping(true);
      toast.success('File processed successfully');
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Error processing file');
    }
  }, [selectedFile, templateFile]);

  const handleMappingChange = useCallback((newMappings) => {
    setMappings(newMappings);
  }, []);

  const handleGenerateTemplate = useCallback(async () => {
    if (!selectedFile || !templateFile || !workbookData) {
      toast.error('Please upload source file');
      return;
    }

    try {
      // Create new workbook for mapped data
      const newWorkbook = XLSX.utils.book_new();
      let hasGeneratedAnySheet = false;

      // Process each template sheet
      templateData.forEach((templateSheet, sheetIndex) => {
        // Create a new sheet
        const newSheet = XLSX.utils.aoa_to_sheet([[]]);

        // Get template headers for this sheet
        const templateHeaders = templateSheet.headers.map(header => 
          `${templateSheet.name}|${header.field}`
        );
        const headerRow = templateHeaders.map(header => header.split('|')[1]);
        
        // Check if this sheet has any mappings
        const hasMappings = templateHeaders.some(field => mappings[field]);
        if (!hasMappings) {
          // Only show error for the first sheet
          if (sheetIndex === 0) {
            toast.error('Please map at least one field before generating template');
            return;
          }
          // Skip other sheets silently
          return;
        }

        // Add headers to sheet
        XLSX.utils.sheet_add_aoa(newSheet, [headerRow], { origin: 0 });

        // Find corresponding source sheet and its data
        const sourceSheetMappings = new Map(); // Map to store source sheet data
        templateHeaders.forEach(templateField => {
          const mapping = mappings[templateField];
          if (mapping) {
            const [sheetName, field] = mapping.split('|');
            if (!sourceSheetMappings.has(sheetName)) {
              const sourceSheet = workbookData.find(sheet => sheet.name === sheetName);
              if (sourceSheet) {
                sourceSheetMappings.set(sheetName, sourceSheet);
              }
            }
          }
        });

        // Get primary source sheet (first one with mappings)
        const primarySourceSheet = sourceSheetMappings.values().next().value;
        if (!primarySourceSheet) {
          // Skip this sheet silently
          return;
        }

        // Map data according to mappings
        const mappedData = primarySourceSheet.data.map(row => {
          return templateHeaders.map(templateField => {
            const sourceField = mappings[templateField];
            if (!sourceField) return ''; // Return empty string for unmapped fields

            const [sourceSheetName, sourceHeader] = sourceField.split('|');
            const sourceSheet = sourceSheetMappings.get(sourceSheetName);
            if (!sourceSheet) return '';

            const sourceHeaderObj = sourceSheet.headers.find(h => h.field === sourceHeader);
            if (!sourceHeaderObj) return '';

            const sourceIndex = sourceSheet.headers.indexOf(sourceHeaderObj);
            return row[sourceIndex] || '';
          });
        });

        // Add mapped data to sheet
        XLSX.utils.sheet_add_aoa(newSheet, mappedData, { origin: 'A2' });
        
        // Add the sheet to workbook with original template sheet name
        XLSX.utils.book_append_sheet(newWorkbook, newSheet, templateSheet.name);
        hasGeneratedAnySheet = true;
      });

      if (!hasGeneratedAnySheet) {
        return; // Exit silently if no sheets were generated (error already shown if needed)
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      setGeneratedTemplate(blob);
      toast.success('Template generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Error generating template. Please try again.');
    }
  }, [selectedFile, templateFile, workbookData, mappings, templateData]);

  const handleDownloadTemplate = useCallback(() => {
    if (!generatedTemplate) return;

    try {
      const url = window.URL.createObjectURL(generatedTemplate);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const baseFileName = selectedFile 
        ? selectedFile.name.split('.').slice(0, -1).join('.')
        : 'template';
      const fileName = `${baseFileName}_mapped.xlsx`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 0);

      // Reset only the generated template to show generate button again
      setGeneratedTemplate(null);
      toast.success('Template downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Error downloading template. Please try again.');
    }
  }, [generatedTemplate, selectedFile]);

  return (
    <main className="flex-1 p-8">
      <div className="grid grid-cols-[400px,1fr] gap-8 h-[calc(100vh-200px)]">
        {/* Left Panel - Files */}
        <div className="bg-white rounded-lg shadow-lg px-6 py-4 overflow-auto">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Files</h2>
          
          {/* Source Files Section */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-700">Source Files</h3>
            <FileDropzone 
              onDrop={handleFilesUpload}
              accept={{
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls']
              }}
              multiple={true}
            />
            
            {uploadedFiles.length > 0 && (
              <div className="space-y-2 mt-4">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={file.id || index} 
                    className={`w-full border rounded-lg px-4 py-2 transition-colors group cursor-pointer ${
                      selectedFile && selectedFile.id === file.id 
                        ? 'bg-blue-100 text-gray-800 border-blue-400' 
                        : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-blue-500'
                    }`}
                    onClick={() => handleSelectFile(file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center" style={{ minWidth: '200px' }}>
                        <div className="w-5 h-5 mr-3">
                          {selectedFile && selectedFile.id === file.id && (
                            <Image 
                              src="/check.png"
                              alt="Selected source"
                              width={20}
                              height={20}
                            />
                          )}
                        </div>
                        <span className={`text-sm text-lg ${selectedFile && selectedFile.id === file.id ? 'text-gray-800' : 'text-gray-600'}`}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-end" style={{ width: '30px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Image 
                            src="/close.png"
                            alt="Remove file"
                            width={20}
                            height={20}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Process Button */}
            {uploadedFiles.length > 0 && (
              <div className="flex justify-center mt-6">
                <button 
                  className={`px-6 py-3 rounded-lg transition-colors ${
                    !templateFile
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : selectedFile && templateFile
                        ? 'bg-[#64afec] hover:bg-[#5193c7] text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={handleProcess}
                  disabled={!selectedFile || !templateFile}
                >
                  {!templateFile 
                    ? 'Loading Template...' 
                    : !selectedFile 
                      ? 'Select Source File'
                      : 'Process File'
                  }
                </button>
              </div>
            )}
          </div>

          {/* Template Section */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4 text-gray-700">Template File</h3>
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">
                Loading business template...
              </div>
            ) : templateFile ? (
              <div className="space-y-2">
                <div 
                  className={`w-full border rounded-lg px-4 py-2 transition-colors group ${
                    'bg-blue-100 text-gray-800 border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center" style={{ minWidth: '200px' }}>
                      <div className="w-5 h-5 mr-3">
                        <Image 
                          src="/check.png"
                          alt="Selected template"
                          width={20}
                          height={20}
                        />
                      </div>
                      <span className="text-sm text-lg text-gray-800">
                        {templateFile.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-end" style={{ width: '30px' }}>
                      <button
                        className="p-1.5 opacity-0"
                      >
                        <Image 
                          src="/close.png"
                          alt="Remove template file"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-red-500">
                Error loading template. Please refresh the page.
              </div>
            )}

            {/* Template Actions */}
            {showMapping && (
              <div className="mt-4">
                {!generatedTemplate ? (
                  <div className="flex justify-center">
                    <button
                      onClick={handleGenerateTemplate}
                      disabled={!selectedFile || Object.keys(mappings).length === 0}
                      className={`px-6 py-3 rounded-lg transition-colors ${
                        selectedFile && Object.keys(mappings).length > 0
                          ? 'bg-[#64afec] hover:bg-[#5193c7] text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Generate Template
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Click the ICON to download.</span>
                      <button
                        onClick={handleDownloadTemplate}
                        className="px-4 py-2 transition-colors text-sm hover:bg-green-100 rounded-lg"
                        title="Download template"
                      >
                        <Image 
                          src="/download.png"
                          alt="Download template"
                          width={20}
                          height={20}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Mapping */}
        <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="text-2xl font-semibold text-gray-800">Mapping</h2>
          </div>
        
          {showMapping && workbookData ? (
            <div className="flex flex-col flex-grow min-h-0">
              <div className="mb-4 p-4 bg-blue-100 text-[#64afec] rounded-md flex-shrink-0">
                {selectedFile?.name}
              </div>
              <div className="flex-grow overflow-hidden">
                <MappingInterface 
                  workbookData={workbookData}
                  templateData={templateData}
                  onGenerateTemplate={handleMappingChange}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-lg text-gray-500">
              {selectedFile 
                ? "Click Process to start mapping" 
                : "Select a source file to process"}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
