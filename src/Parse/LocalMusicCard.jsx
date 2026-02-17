import { useState } from 'react'

function formatFileSize (bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime (ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LocalMusicCard ({ file, onRefresh }) {
  const [deleting, setDeleting] = useState(false)

  const handleOpen = () => {
    // 使用 shellOpenPath 打开文件（默认关联程序播放）
    window.utools.shellOpenPath(file.filePath)
  }

  const handleShowInFolder = () => {
    window.utools.shellShowItemInFolder(file.filePath)
  }

  const handleDelete = () => {
    if (window.confirm(`确定要删除 "${file.name}" 吗？此操作将永久删除文件。`)) {
      setDeleting(true)
      try {
        const success = window.services.deleteFile(file.filePath)
        if (success) {
          window.utools.showNotification('文件已删除')
          if (onRefresh) onRefresh()
        } else {
          window.utools.showNotification('删除失败，文件可能不存在')
        }
      } catch (e) {
        window.utools.showNotification('删除出错: ' + e.message)
      } finally {
        setDeleting(false)
      }
    }
  }

  return (
    <div className='music-card'>
      <div className='music-card-body'>
        <div className='card-top-tags'>
          <span className='card-platform-tag local-tag'>本地文件</span>
          <span className='card-time-tag'>{formatTime(file.time)}</span>
        </div>
        
        <div className='music-info'>
          <div className='music-title music-title-link' onClick={handleOpen} title='点击播放'>
            {file.name}
          </div>
          <div className='music-artist'>{file.artist}</div>
          <div className='music-meta'>
            <span className='meta-tag'>{formatFileSize(file.size)}</span>
            <span className='meta-tag'>{file.filePath}</span>
          </div>
        </div>
      </div>

      <div className='music-card-actions'>
        <button className='btn-primary btn-sm' onClick={handleOpen}>
          播放
        </button>
        <button className='btn-secondary btn-sm' onClick={handleShowInFolder}>
          打开位置
        </button>
        <button className='btn-danger btn-sm' onClick={handleDelete} disabled={deleting}>
          {deleting ? '删除中...' : '删除文件'}
        </button>
      </div>
    </div>
  )
}
