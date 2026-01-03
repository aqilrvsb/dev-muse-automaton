import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import { put } from '@vercel/blob'
import Layout from '../components/Layout'

type BankImage = {
  id: string
  user_id: string
  name: string
  image_url: string
  blob_url: string | null
  created_at: string
  updated_at: string
}

export default function BankImage() {
  const { user } = useAuth()
  const [images, setImages] = useState<BankImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<BankImage | null>(null)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [entriesPerPage, setEntriesPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const hasLoadedRef = useRef(false)

  // Form state
  const [imageName, setImageName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      fetchImages()
    }
  }, [user])

  const fetchImages = async () => {
    try {
      setLoading(true)
      hasLoadedRef.current = true
      const { data, error } = await supabase
        .from('bank_images')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setImages(data || [])
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to fetch images',
      })
    } finally {
      setLoading(false)
    }
  }

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          // Calculate new dimensions (max 1200px width/height)
          let width = img.width
          let height = img.height
          const maxDimension = 1200

          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          // Compress with quality 0.8
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'))
                return
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            },
            'image/jpeg',
            0.8
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type - accept images, mp3, and mp4
    const allowedTypes = ['image/', 'audio/mpeg', 'audio/mp3', 'video/mp4']
    const isAllowed = allowedTypes.some(type => file.type.startsWith(type) || file.type === type)

    if (!isAllowed) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Please select an image (jpg, png, etc.), MP3, or MP4 file',
      })
      e.target.value = ''
      return
    }

    try {
      // Only compress images, not audio/video
      let finalFile = file

      if (file.type.startsWith('image/')) {
        // Compress the image
        finalFile = await compressImage(file)

        // Check compressed size (max 300KB for images)
        const maxSize = 300 * 1024 // 300KB in bytes
        if (finalFile.size > maxSize) {
          Swal.fire({
            icon: 'error',
            title: 'File Too Large',
            text: `Image is still ${(finalFile.size / 1024).toFixed(0)}KB after compression. Please select a smaller image.`,
          })
          e.target.value = ''
          return
        }
      } else {
        // For audio/video, check max size (10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB in bytes
        if (file.size > maxSize) {
          Swal.fire({
            icon: 'error',
            title: 'File Too Large',
            text: `File is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed is 10MB.`,
          })
          e.target.value = ''
          return
        }
      }

      setSelectedFile(finalFile)

      // Create preview for images only
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(finalFile)
      } else {
        setPreviewUrl(null)
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Processing Failed',
        text: 'Failed to process file. Please try another file.',
      })
      e.target.value = ''
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !imageName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please provide both image name and file',
      })
      return
    }

    try {
      setUploading(true)

      // Upload to Vercel Blob
      const token = import.meta.env.VITE_BLOB_READ_WRITE_TOKEN
      if (!token) {
        throw new Error('Blob storage token not configured')
      }

      // Create clean filename using email and image name
      const emailPrefix = user?.email?.split('@')[0] || 'user'
      const cleanImageName = imageName.trim().replace(/[^a-zA-Z0-9-_]/g, '-')
      const fileExtension = selectedFile.name.split('.').pop() || 'jpg'
      const filename = `${emailPrefix}/${cleanImageName}.${fileExtension}`

      const blob = await put(filename, selectedFile, {
        access: 'public',
        token,
      })

      // Save to database
      const { error } = await supabase
        .from('bank_images')
        .insert({
          user_id: user?.id,
          name: imageName.trim(),
          image_url: blob.url,
          blob_url: blob.url,
        })

      if (error) throw error

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Image uploaded successfully!',
        timer: 2000,
        showConfirmButton: false,
      })

      // Reset form and close modal
      setImageName('')
      setSelectedFile(null)
      setPreviewUrl(null)
      setShowUploadModal(false)
      fetchImages()
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: error.message || 'Failed to upload image',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedImage || !imageName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please provide image name',
      })
      return
    }

    try {
      setUploading(true)
      let newImageUrl = selectedImage.image_url
      let newBlobUrl = selectedImage.blob_url

      // If a new file is selected, upload it and delete the old one
      if (selectedFile) {
        const token = import.meta.env.VITE_BLOB_READ_WRITE_TOKEN
        if (!token) {
          throw new Error('Blob storage token not configured')
        }

        // Create clean filename using email and image name
        const emailPrefix = user?.email?.split('@')[0] || 'user'
        const cleanImageName = imageName.trim().replace(/[^a-zA-Z0-9-_]/g, '-')
        const fileExtension = selectedFile.name.split('.').pop() || 'jpg'
        const filename = `${emailPrefix}/${cleanImageName}.${fileExtension}`

        // Upload new image
        console.log('Uploading new image to Blob storage...')
        const blob = await put(filename, selectedFile, {
          access: 'public',
          token,
        })
        console.log('New image uploaded:', blob.url)
        newImageUrl = blob.url
        newBlobUrl = blob.url

        // Delete old image from Vercel Blob using server-side API if it exists
        if (selectedImage.blob_url) {
          try {
            console.log('Calling API to delete old image from Blob:', selectedImage.blob_url)
            const response = await fetch('/api/delete-blob', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: selectedImage.blob_url }),
            })

            const data = await response.json()

            if (!response.ok) {
              console.error('API delete failed:', data)
              throw new Error(data.error || 'Failed to delete old image from Blob storage')
            }

            console.log('Successfully deleted old image from Blob storage via API')
          } catch (blobError: any) {
            console.error('Failed to delete old image from Blob storage:', blobError)
            console.warn('Continuing with update despite Blob deletion error')
            // Continue with update even if old blob deletion fails
          }
        }
      }

      // Update database
      const { error } = await supabase
        .from('bank_images')
        .update({
          name: imageName.trim(),
          image_url: newImageUrl,
          blob_url: newBlobUrl,
        })
        .eq('id', selectedImage.id)

      if (error) throw error

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Image updated successfully!',
        timer: 2000,
        showConfirmButton: false,
      })

      setShowEditModal(false)
      setSelectedImage(null)
      setImageName('')
      setSelectedFile(null)
      setPreviewUrl(null)
      fetchImages()
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message || 'Failed to update image',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (image: BankImage) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    })

    if (!result.isConfirmed) return

    try {
      // Delete from Vercel Blob using server-side API if blob_url exists
      if (image.blob_url) {
        try {
          console.log('Calling API to delete from Blob:', image.blob_url)
          const response = await fetch('/api/delete-blob', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: image.blob_url }),
          })

          const data = await response.json()

          if (!response.ok) {
            console.error('API delete failed:', data)
            throw new Error(data.error || 'Failed to delete from Blob storage')
          }

          console.log('Successfully deleted from Blob storage via API')
        } catch (blobError: any) {
          console.error('Blob deletion error:', blobError)
          console.warn('Continuing with database deletion despite Blob error')
          // Continue with database deletion even if blob deletion fails
        }
      } else {
        console.log('No blob_url found, skipping Blob deletion')
      }

      // Delete from database
      const { error } = await supabase
        .from('bank_images')
        .delete()
        .eq('id', image.id)

      if (error) throw error

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Image has been deleted. Note: Blob cache may take up to 1 minute to clear.',
        timer: 3000,
        showConfirmButton: false,
      })

      fetchImages()
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: error.message || 'Failed to delete image',
      })
    }
  }

  const openEditModal = (image: BankImage) => {
    setSelectedImage(image)
    setImageName(image.name)
    setShowEditModal(true)
  }

  const openViewModal = (image: BankImage) => {
    setSelectedImage(image)
    setShowViewModal(true)
  }

  const exportToCSV = () => {
    const headers = ['NO', 'NAMA IMAGE', 'URL IMAGE', 'CREATED AT']
    const rows = filteredImages.map((img, idx) => [
      idx + 1,
      img.name,
      img.image_url,
      new Date(img.created_at).toLocaleString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bank-images-${Date.now()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Filter images based on search term
  const filteredImages = images.filter(img =>
    img.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination
  const totalPages = Math.ceil(filteredImages.length / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const endIndex = startIndex + entriesPerPage
  const paginatedImages = filteredImages.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search or entries per page changes
  }, [searchTerm, entriesPerPage])

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-gray-900">Bank Image</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your media assets (images, MP3, MP4)</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              <span className="text-lg">➕</span>
              <span>Upload File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Table Controls */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Show</label>
                  <select
                    value={entriesPerPage}
                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                    className="bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <label className="text-sm text-gray-700">entries</label>
                </div>

                <button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span>📊</span>
                  <span>Export CSV</span>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">NO</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">NAMA IMAGE</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">IMAGE</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">URL IMAGE</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedImages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">📁</span>
                        <p>No images found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedImages.map((image, idx) => (
                    <tr key={image.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">{startIndex + idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{image.name}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openViewModal(image)}
                          className="relative group"
                        >
                          <img
                            src={image.image_url}
                            alt={image.name}
                            className="h-16 w-16 object-cover rounded-lg border border-gray-200 group-hover:opacity-75 transition-opacity"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="bg-black/50 text-white px-2 py-1 rounded text-xs">View</span>
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={image.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 hover:underline text-sm max-w-xs truncate block"
                          >
                            {image.image_url}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(image.image_url)
                              alert('Copied!')
                            }}
                            className="flex-shrink-0 text-gray-600 hover:text-primary-600 transition-colors p-1 hover:bg-gray-100 rounded"
                            title="Copy URL"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(image)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            UPDATE
                          </button>
                          <button
                            onClick={() => handleDelete(image)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredImages.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredImages.length)} of {filteredImages.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-1.5 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Upload New Image</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter image name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*,audio/mpeg,audio/mp3,video/mp4"
                  onChange={handleFileSelect}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-1">Images compressed to &lt;300KB | MP3/MP4 max 10MB</p>
              </div>

              {previewUrl && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg"
                  />
                  {selectedFile && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false)
                  setImageName('')
                  setSelectedFile(null)
                  setPreviewUrl(null)
                }}
                className="flex-1 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !imageName.trim()}
                className="flex-1 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Update Image</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter image name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Replace File (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,audio/mpeg,audio/mp3,video/mp4"
                  onChange={handleFileSelect}
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to keep current file</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">{previewUrl ? 'New Image Preview:' : 'Current Image:'}</p>
                <img
                  src={previewUrl || selectedImage.image_url}
                  alt={selectedImage.name}
                  className="max-h-48 mx-auto rounded-lg"
                />
                {selectedFile && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedImage(null)
                  setImageName('')
                  setSelectedFile(null)
                  setPreviewUrl(null)
                }}
                className="flex-1 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={uploading || !imageName.trim()}
                className="flex-1 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{selectedImage.name}</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.name}
                className="max-h-[60vh] mx-auto rounded-lg"
              />
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">URL:</span>{' '}
                <a
                  href={selectedImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 hover:underline break-all"
                >
                  {selectedImage.image_url}
                </a>
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Created:</span> {new Date(selectedImage.created_at).toLocaleString()}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Updated:</span> {new Date(selectedImage.updated_at).toLocaleString()}
              </p>
            </div>

            <div className="flex gap-4 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="flex-1 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  )
}
