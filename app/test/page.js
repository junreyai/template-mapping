'use client';

import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import toast from 'react-hot-toast';
import MappingInterface from '../components/MappingInterface';
import FileDropzone from '../components/FileDropzone';

export default function Test() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [templateFiles, setTemplateFiles] = useState([]);
  const [templateFile, setTemplateFile] = useState(null);
  const [workbookData, setWorkbookData] = useState(null);
  const [templateData, setTemplateData] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [mappings, setMappings] = useState({});
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);

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

  const handleTemplateFilesUpload = useCallback((files) => {
    if (files && files.length > 0) {
      const newFiles = files.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result;
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            // Process template sheets with actual sheet names
            const sheets = workbook.SheetNames.map(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
              
              return {
                name: sheetName, // Use actual sheet name from Excel
                headers: headerRow.map(header => ({ field: header?.toString() || '' }))
                  .filter(header => header.field.trim() !== '')
              };
            }).filter(sheet => sheet.headers.length > 0);

            if (sheets.length === 0) {
              toast.error(`No valid headers found in template: ${file.name}`);
              resolve(null);
              return;
            }

            resolve({
              id: Date.now() + Math.random(),
              name: file.name,
              type: file.type,
              data: arrayBuffer,
              sheets,
              lastModified: file.lastModified
            });
          };
          reader.readAsArrayBuffer(file);
        });
      });

      Promise.all(newFiles).then(fileDataArray => {
        const validFiles = fileDataArray.filter(file => file !== null);
        if (validFiles.length > 0) {
          setTemplateFiles(prev => [...prev, ...validFiles]);
          // Only set the first file as template if no template is currently selected
          if (!templateFile) {
            setTemplateFile(validFiles[0]);
            setTemplateData(validFiles[0].sheets);
          }
          toast.success(`Successfully uploaded ${validFiles.length} template file(s)`);
        }
      });
    }
  }, [templateFile]);

  const handleRemoveTemplate = useCallback((index) => {
    setTemplateFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
    toast.success('Template file removed');
  }, []);

  const handleSelectTemplate = useCallback((templateFile) => {
    setTemplateFile(templateFile);
    setTemplateData(templateFile.sheets);
  }, []);

  const handleProcess = useCallback(async () => {
    if (selectedFiles.length === 0 || !templateFile) return;

    try {
      // Process all selected files
      const processedFiles = await Promise.all(selectedFiles.map(async (file) => {
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
            fileName: file.name,
            fileId: file.id
          };
        }).filter(sheet => sheet !== null && sheet.headers.length > 0);
        
        return processedSheets;
      }));

      // Flatten all sheets from all files
      const allSheets = processedFiles.flat();
      
      if (allSheets.length === 0) {
        toast.error('No valid data found in source files');
        return;
      }

      setWorkbookData(allSheets);
      setShowMapping(true);
      setActiveFile(selectedFiles[0]);
      toast.success('Files processed successfully');
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Error processing files');
    }
  }, [selectedFiles, templateFile]);

  const handleMappingChange = useCallback((newMappings) => {
    console.log('New mappings:', newMappings); // Add logging for debugging
    setMappings(newMappings);
  }, []);

  const handleGenerateTemplate = useCallback(async () => {
    console.log('Current mappings:', mappings); // Add logging for debugging
    
    if (!selectedFiles.length || !templateFile || !workbookData) {
      toast.error('Please upload both source and template files');
      return;
    }

    if (Object.keys(mappings).length === 0) {
      toast.error('Please map at least one field before generating template');
      return;
    }

    try {
      // Create new workbook for mapped data
      const newWorkbook = XLSX.utils.book_new();
      let hasGeneratedAnySheet = false;

      // Get unique sheet names from mappings
      const mappedSheetNames = new Set(
        Object.values(mappings).map(mapping => mapping.split('|')[0])
      );

      // Process each mapped sheet
      for (const sheetName of mappedSheetNames) {
        // Find the source sheet
        const sourceSheet = workbookData.find(sheet => sheet.name === sheetName);
        if (!sourceSheet) continue;

        // Create a new sheet
        const newSheet = XLSX.utils.aoa_to_sheet([[]]);

        // Get all mappings for this sheet
        const sheetMappings = Object.entries(mappings)
          .filter(([_, value]) => value.startsWith(`${sheetName}|`));

        if (sheetMappings.length === 0) continue;

        // Create header row from template fields
        const headerRow = sheetMappings.map(([templateKey]) => templateKey.split('|')[1]);
        XLSX.utils.sheet_add_aoa(newSheet, [headerRow], { origin: 0 });

        // Map data according to mappings
        const mappedData = sourceSheet.data.map(row => {
          return sheetMappings.map(([templateKey, sourceMapping]) => {
            const [_, sourceField] = sourceMapping.split('|');
            const sourceHeaderIndex = sourceSheet.headers.findIndex(h => h.field === sourceField);
            return sourceHeaderIndex >= 0 ? row[sourceHeaderIndex] || '' : '';
          });
        });

        // Add mapped data to sheet
        XLSX.utils.sheet_add_aoa(newSheet, mappedData, { origin: 'A2' });
        
        // Add the sheet to workbook
        XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
        hasGeneratedAnySheet = true;
      }

      if (!hasGeneratedAnySheet) {
        toast.error('No valid data to generate template');
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
  }, [selectedFiles, templateFile, workbookData, mappings]);

  const handleDownloadTemplate = useCallback(() => {
    if (!generatedTemplate) return;

    try {
      const url = window.URL.createObjectURL(generatedTemplate);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const baseFileName = selectedFiles.length > 0 
        ? selectedFiles[0].name.split('.').slice(0, -1).join('.')
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
  }, [generatedTemplate, selectedFiles]);

  const handleRemoveFile = (indexToRemove) => {
    setUploadedFiles(files => files.filter((_, index) => index !== indexToRemove));
    setSelectedFiles(prevFiles => {
      const removedFile = uploadedFiles[indexToRemove];
      return prevFiles.filter(file => file.id !== removedFile?.id);
    });
    if (selectedFiles.length <= 1) {
      setShowMapping(false);
      setWorkbookData(null);
    }
    toast.success('Source file removed');
  };

  const handleSelectFile = (file) => {
    setSelectedFiles(prevFiles => {
      const isSelected = prevFiles.some(f => f.id === file.id);
      if (isSelected) {
        // If file is already selected, remove it
        const newFiles = prevFiles.filter(f => f.id !== file.id);
        if (newFiles.length === 0) {
          setShowMapping(false);
          setWorkbookData(null);
        }
        return newFiles;
      } else {
        // Add the file to selected files
        return [...prevFiles, file];
      }
    });
  };

  const handleReset = useCallback(() => {
    setSelectedFiles([]);
    setWorkbookData(null);
    setTemplateFile(null);
    setTemplateData(null);
    setTemplateFiles([]); // Clear template files array
    setGeneratedTemplate(null);
    setShowMapping(false);
    setMappings({});
    setUploadedFiles([]);
    setActiveFile(null);
    toast.success('All data has been reset successfully');
  }, []);

  const { getRootProps: getTemplateRootProps, getInputProps: getTemplateInputProps, isDragActive: isTemplateDragActive } = useDropzone({
    onDrop: handleTemplateFilesUpload,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 10,
    multiple: true
  });

  return (
    <>
      <main className="flex-1 p-8">
        <div className="grid grid-cols-[400px,1fr] gap-8 h-[calc(100vh-200px)]">
          {/* Left Panel - Files */}
          <div className="bg-white rounded-lg shadow-lg p-6 overflow-auto">
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
              
              {/* File List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
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
                        : selectedFiles.length > 0 && templateFile
                          ? 'bg-[#64afec] hover:bg-[#5193c7] text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    onClick={handleProcess}
                    disabled={selectedFiles.length === 0 || !templateFile}
                  >
                    {!templateFile 
                      ? 'Select Template File First' 
                      : selectedFiles.length === 0
                        ? 'Select Source Files'
                        : `Process ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
                    }
                  </button>
                </div>
              )}
            </div>

            {/* Template Section */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4 text-gray-700">Template Files</h3>
              <div
                {...getTemplateRootProps()}
                className={`w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 group mb-4
                  ${isTemplateDragActive ? 'border-[#64afec] bg-blue-100' : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'}`}
              >
                <input {...getTemplateInputProps()} />
                <div className="space-y-2">
                  <div className="mx-auto text-center text-gray-400 text-2xl mb-2">📄</div>
                  <p className="text-sm text-gray-500">
                    {isTemplateDragActive ? "Drop the template here..." : "Drag and drop template file, or click to select"}
                  </p>
                </div>
              </div>
              {templateFiles.length > 0 && (
                <div className="space-y-2 mt-4">
                  {templateFiles.map((file, index) => (
                    <div 
                      key={file.id || index}
                      className={`w-full border rounded-lg px-4 py-2 transition-colors group cursor-pointer ${
                        templateFile && templateFile.id === file.id 
                          ? 'bg-blue-100 text-gray-800 border-blue-400'
                          : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-blue-500'
                      }`}
                      onClick={() => {
                        if (templateFile && templateFile.id === file.id) {
                          setTemplateFile(null);
                          setTemplateData(null);
                          setGeneratedTemplate(null);
                          setShowMapping(false);
                          setMappings({});
                        } else {
                          setTemplateFile(file);
                          setTemplateData(file.sheets);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center" style={{ minWidth: '200px' }}>
                          <div className="w-5 h-5 mr-3">
                            {templateFile && templateFile.id === file.id && (
                              <Image 
                                src="/check.png"
                                alt="Selected template"
                                width={20}
                                height={20}
                              />
                            )}
                          </div>
                          <span className={`text-sm text-lg ${templateFile && templateFile.id === file.id ? 'text-gray-800' : 'text-gray-600'}`}>
                            {file.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-end" style={{ width: '30px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (templateFile && templateFile.id === file.id) {
                                setTemplateFile(null);
                                setTemplateData(null);
                                setGeneratedTemplate(null);
                                setShowMapping(false);
                                setMappings({});
                              }
                              const newFiles = templateFiles.filter((_, i) => i !== index);
                              setTemplateFiles(newFiles);
                              toast.success('Template file removed');
                            }}
                            className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
              )}
            </div>
            {/* Template Actions */}
            {showMapping && (
              <div className="mt-4">
                {!generatedTemplate ? (
                  <div className="flex justify-center">
                    <button
                      onClick={handleGenerateTemplate}
                      disabled={!selectedFiles.length || Object.keys(mappings).length === 0}
                      className={`px-6 py-3 rounded-lg transition-colors ${
                        selectedFiles.length && Object.keys(mappings).length > 0
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

          {/* Right Panel - Mapping */}
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h2 className="text-2xl font-semibold text-gray-800">Mapping</h2>
              {showMapping && (
                <button
                  onClick={handleReset}
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
                    {selectedFiles.map((file, index) => (
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
    </>
  );
}
