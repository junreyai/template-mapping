'use client';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

export default function FileDropzone({ onDrop, accept, multiple = false }) {
  const handleDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      if (multiple) {
        onDrop(acceptedFiles);
      } else {
        const file = acceptedFiles[0]; // Only take the first file
        onDrop([file]);
      }
    }
  }, [onDrop, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    onDrop: handleDrop,
    maxFiles: multiple ? undefined : 1,
    multiple
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 mb-4
        ${isDragActive ? 'border-[#64afec] bg-blue-100' : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'}`}
    >
      <input {...getInputProps()} />
      <div className="space-y-2">
        <div className="mx-auto text-center text-gray-400 text-2xl mb-2">📄</div>
        <p className="text-sm text-gray-500">
          {isDragActive 
            ? multiple 
              ? "Drop the files here..." 
              : "Drop the file here..." 
            : multiple 
              ? "Drag and drop source files, or click to select"
              : "Drag and drop source file, or click to select"
          }
        </p>
      </div>
    </div>
  );
}
