'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, AlertCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number
  isLoading?: boolean
}

export function FileUpload({ onFileSelect, accept = '.pdf,.jpg,.jpeg,.png', maxSize = 10 * 1024 * 1024, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): boolean => {
    setError(null)
    
    if (file.size > maxSize) {
      setError(`File size must be less than ${maxSize / (1024 * 1024)}MB`)
      return false
    }

    const acceptedTypes = accept.split(',').map(type => type.trim())
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!acceptedTypes.includes(fileExtension)) {
      setError(`File type not supported. Accepted types: ${accept}`)
      return false
    }

    return true
  }

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
          } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 bg-gray-100 rounded-full">
              <Upload className="h-8 w-8 text-gray-600" />
            </div>
            
            <div>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-500">Click to upload</span>
                <span className="text-gray-600"> or drag and drop</span>
              </Label>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                accept={accept}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            
            <p className="text-sm text-gray-500">
              Supports: {accept} (max {maxSize / (1024 * 1024)}MB)
            </p>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
