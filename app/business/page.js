'use client';

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import toast from 'react-hot-toast';
import MappingInterface from '../components/MappingInterface';
import FileDropzone from '../components/FileDropzone';
import { supabase } from '@/lib/supabase';
import { useNavigationPrompt } from '../hooks/useNavigationPrompt';

export default function Business() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [workbookData, setWorkbookData] = useState(null);
  const [templateData, setTemplateData] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [mappings, setMappings] = useState({});
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [templateFiles, setTemplateFiles] = useState([]);
  const [error, setError] = useState(null);
  const [selectedTemplateFile, setSelectedTemplateFile] = useState(null);

  // Add navigation prompt
  const hasChanges = uploadedFiles.length > 0 || templateFiles.length > 0 || Object.keys(mappings).length > 0;
  useNavigationPrompt(hasChanges);

  // Load template from Supabase on component mount
  useEffect(() => {
    const loadTemplate = async () => {
      const bucketName = 'freetemplate';
      const folderPath = 'business/';

      try {
        setIsLoading(true);
        setError(null);

        // Fetch the list of files from the specified bucket/folder
        const { data, error: listError } = await supabase.storage
          .from(bucketName)
          .list(folderPath, { limit: 10, offset: 0 });

        console.log('Fetched files data:', data);

        if (listError) {
          setError(listError.message);
          toast.error('Error loading template files');
          return;
        }

        if (!data || data.length === 0) {
          setError('No template files found in this folder.');
          toast.error('No template files found');
          return;
        }

        // Store all template files
        setTemplateFiles(data);

        // Get the first template file by default
        const templateFile = data[0];

        // Get the download URL for the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucketName)
          .download(`${folderPath}${templateFile.name}`);

        if (downloadError) {
          setError(downloadError.message);
          toast.error('Error downloading template');
          return;
        }

        // Convert blob to array buffer
        const arrayBuffer = await fileData.arrayBuffer();
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
          setError('No valid headers found in template');
          throw new Error('No valid headers found in template');
        }

        setTemplateFile({ 
          id: templateFile.id || '',
          name: templateFile.name, 
          data: uint8Array,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        setSelectedTemplateFile(templateFile);
        setTemplateData(sheets);
      } catch (error) {
        console.error('Error loading template:', error);
        setError(error.message || 'Error loading business template');
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
    setSelectedFiles(prevFiles => {
      const isSelected = prevFiles.some(f => f.id === file.id);
      if (isSelected) {
        // If file is already selected, remove it
        const newFiles = prevFiles.filter(f => f.id !== file.id);
        if (newFiles.length === 0) {
          setShowMapping(false);
          setWorkbookData(null);
          setMappings({});
        }
        return newFiles;
      } else {
        // Add the file to selected files
        return [...prevFiles, file];
      }
    });
  };

  const handleRemoveFile = (indexToRemove) => {
    const removedFile = uploadedFiles[indexToRemove];
    setUploadedFiles(files => files.filter((_, index) => index !== indexToRemove));
    setSelectedFiles(files => files.filter(file => file.id !== removedFile.id));
    
    // Reset mapping if no files are selected
    if (selectedFiles.length <= 1) {
      setShowMapping(false);
      setWorkbookData(null);
      setMappings({});
    }
    toast.success('Source file removed');
  };

  const handleProcess = useCallback(async () => {
    if (!selectedFiles.length || !templateFile) {
      toast.error('Please select source files');
      return;
    }

    try {
      // Process all selected files
      const allProcessedSheets = [];
      
      for (const file of selectedFiles) {
        // Read each source file
        const sourceWorkbook = XLSX.read(file.data, { type: 'array' });
        
        // Process all sheets in the file
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
            data: sourceData.slice(1),
            sourceFile: file.name,
            fileId: file.id // Add fileId for reference
          };
        }).filter(Boolean);

        allProcessedSheets.push(...processedSheets);
      }

      if (allProcessedSheets.length === 0) {
        throw new Error('No valid data found in selected files');
      }

      setWorkbookData(allProcessedSheets);
      setActiveFile(selectedFiles[0]);
      setShowMapping(true);
      toast.success('Files processed successfully');
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error(error.message || 'Error processing files');
    }
  }, [selectedFiles, templateFile]);

  const handleMappingChange = useCallback((newMappings) => {
    setMappings(newMappings);
  }, []);

  const handleGenerateTemplate = useCallback(async () => {
    if (!workbookData || !templateFile) {
      toast.error('Please process source files');
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
          if (sheetIndex === 0) {
            toast.error('Please map at least one field before generating template');
            return;
          }
          return;
        }

        // Add headers to sheet
        XLSX.utils.sheet_add_aoa(newSheet, [headerRow], { origin: 0 });

        // Find corresponding source sheet and its data
        const sourceSheetMappings = new Map();
        templateHeaders.forEach(templateField => {
          const mapping = mappings[templateField];
          if (mapping) {
            const [sheetName, field] = mapping.split('|');
            // Find the sheet in any of the processed files
            const sourceSheet = workbookData.find(sheet => sheet.name === sheetName);
            if (sourceSheet) {
              sourceSheetMappings.set(sheetName, sourceSheet);
            }
          }
        });

        // Get primary source sheet (first one with mappings)
        const primarySourceSheet = sourceSheetMappings.values().next().value;
        if (!primarySourceSheet) {
          return;
        }

        // Map data according to mappings
        const mappedData = primarySourceSheet.data.map(row => {
          return templateHeaders.map(templateField => {
            const sourceField = mappings[templateField];
            if (!sourceField) return '';

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
        return;
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
  }, [workbookData, templateFile, mappings, templateData]);

  const handleDownloadTemplate = useCallback(() => {
    if (!generatedTemplate) return;

    try {
      const url = window.URL.createObjectURL(generatedTemplate);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const baseFileName = uploadedFiles.length > 0 
        ? uploadedFiles[0].name.split('.').slice(0, -1).join('.')
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
  }, [generatedTemplate, uploadedFiles]);

  const handleSelectTemplate = async (templateFile) => {
    const bucketName = 'freetemplate';
    const folderPath = 'business/';

    try {
      setIsLoading(true);
      setError(null);

      // Get the download URL for the selected file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(`${folderPath}${templateFile.name}`);

      if (downloadError) {
        setError(downloadError.message);
        toast.error('Error downloading template');
        return;
      }

      // Convert blob to array buffer
      const arrayBuffer = await fileData.arrayBuffer();
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

      setTemplateFile({ 
        id: templateFile.id || '',
        name: templateFile.name, 
        data: uint8Array,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      setSelectedTemplateFile(templateFile);
      setTemplateData(sheets);
      toast.success('Template file selected successfully');
    } catch (error) {
      console.error('Error selecting template:', error);
      setError(error.message || 'Error selecting template');
      toast.error('Error selecting template');
    } finally {
      setIsLoading(false);
    }
  };

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
                      selectedFiles.some(f => f.id === file.id)
                        ? 'bg-blue-100 text-gray-800 border-blue-400' 
                        : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-blue-500'
                    }`}
                    onClick={() => handleSelectFile(file)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center" style={{ minWidth: '200px' }}>
                        <div className="w-5 h-5 mr-3">
                          {selectedFiles.some(f => f.id === file.id) && (
                            <Image 
                              src="/check.png"
                              alt="Selected source"
                              width={20}
                              height={20}
                            />
                          )}
                        </div>
                        <span className={`text-sm text-lg ${selectedFiles.some(f => f.id === file.id) ? 'text-gray-800' : 'text-gray-600'}`}>
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
                      : uploadedFiles.length > 0 && templateFile
                        ? 'bg-[#64afec] hover:bg-[#5193c7] text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={handleProcess}
                  disabled={!uploadedFiles.length || !templateFile}
                >
                  {!templateFile 
                    ? 'Loading Template...' 
                    : !uploadedFiles.length 
                      ? 'Upload Source Files'
                      : 'Process Files'
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
                {templateFiles.map((templateFile, index) => (
                  <div 
                    key={templateFile.id || index} 
                    className={`w-full border rounded-lg px-4 py-2 transition-colors group cursor-pointer ${
                      selectedTemplateFile && selectedTemplateFile.id === templateFile.id 
                        ? 'bg-blue-100 text-gray-800 border-blue-400' 
                        : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-blue-500'
                    }`}
                    onClick={() => handleSelectTemplate(templateFile)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center" style={{ minWidth: '200px' }}>
                        <div className="w-5 h-5 mr-3">
                          {selectedTemplateFile && selectedTemplateFile.id === templateFile.id && (
                            <Image 
                              src="/check.png"
                              alt="Selected template"
                              width={20}
                              height={20}
                            />
                          )}
                        </div>
                        <span className={`text-sm text-lg ${selectedTemplateFile && selectedTemplateFile.id === templateFile.id ? 'text-gray-800' : 'text-gray-600'}`}>
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
                ))}
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
                      disabled={!uploadedFiles.length || Object.keys(mappings).length === 0}
                      className={`px-6 py-3 rounded-lg transition-colors ${
                        uploadedFiles.length > 0 && Object.keys(mappings).length > 0
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
            {showMapping && (
              <button
                onClick={() => {
                  setMappings({});
                  setActiveFile(selectedFiles[0]);
                }}
                className="px-4 py-2 transition-colors text-sm flex items-center gap-2 hover:bg-blue-300 hover:text-white rounded-md"
              >
                <Image 
                  src="/reset.png"
                  alt="Reset"
                  width={20}
                  height={20}
                />
                Reset
              </button>
            )}
          </div>
        
          {showMapping && workbookData ? (
            <div className="flex flex-col flex-grow min-h-0">
              <div className="mb-4 p-4 bg-blue-100 text-[#64afec] rounded-md flex-shrink-0">
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center px-3 py-1 rounded-md cursor-pointer transition-colors ${
                        activeFile?.id === file.id 
                          ? 'bg-[#64afec] text-white' 
                          : 'bg-white hover:bg-blue-50 text-[#64afec]'
                      }`}
                      onClick={() => {
                        setActiveFile(file);
                        toast.success(`Showing sheets from: ${file.name}`);
                      }}
                    >
                      <span>{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-grow overflow-hidden">
                <MappingInterface 
                  workbookData={workbookData.filter(sheet => sheet.fileId === activeFile?.id)}
                  templateData={templateData}
                  onGenerateTemplate={handleMappingChange}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-lg text-gray-500">
              {selectedFiles.length > 0 
                ? "Click Process to start mapping" 
                : "Select files to process"}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
