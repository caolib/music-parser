import { useState } from 'react'

function formatDuration (seconds) {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize (bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getExtByQuality (quality) {
  if (!quality) return 'mp3'
  if (quality.startsWith('flac')) return 'flac'
  return 'mp3'
}

function sanitizeFileName (name) {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

export default function MusicCard ({ song, downloadPath }) {
  const [showJson, setShowJson] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState('')

  const { info, cover, lyrics, url, actualQuality, wasDowngraded, fileSize } = song

  const handleDownloadMusic = async () => {
    if (!url) return
    setDownloading(true)
    setDownloadMsg('')
    try {
      const ext = getExtByQuality(actualQuality)
      const fileName = sanitizeFileName(`${info.artist} - ${info.name}.${ext}`)
      const savePath = window.services.pathJoin(downloadPath, fileName)
      await window.services.downloadFile(url, savePath)
      setDownloadMsg('下载完成')
      window.utools.shellShowItemInFolder(savePath)
    } catch (err) {
      setDownloadMsg('下载失败: ' + (err?.message || '未知错误'))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAll = async () => {
    if (!url) return
    setDownloading(true)
    setDownloadMsg('')
    try {
      const ext = getExtByQuality(actualQuality)
      const fileName = sanitizeFileName(`${info.artist} - ${info.name}.${ext}`)
      const savePath = window.services.pathJoin(downloadPath, fileName)
      await window.services.downloadFile(url, savePath)

      if (lyrics) {
        const lrcName = sanitizeFileName(`${info.artist} - ${info.name}.lrc`)
        const lrcPath = window.services.pathJoin(downloadPath, lrcName)
        window.services.writeTextToPath(lyrics, lrcPath)
      }

      setDownloadMsg(lyrics ? '下载完成（含歌词）' : '下载完成')
      window.utools.shellShowItemInFolder(savePath)
    } catch (err) {
      setDownloadMsg('下载失败: ' + (err?.message || '未知错误'))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadLyrics = () => {
    if (!lyrics) return
    try {
      const lrcName = sanitizeFileName(`${info.artist} - ${info.name}.lrc`)
      const lrcPath = window.services.pathJoin(downloadPath, lrcName)
      window.services.writeTextToPath(lyrics, lrcPath)
      setDownloadMsg('歌词已保存')
      window.utools.shellShowItemInFolder(lrcPath)
    } catch (err) {
      setDownloadMsg('保存失败: ' + (err?.message || '未知错误'))
    }
  }

  return (
    <div className='music-card'>
      <div className='music-card-body'>
        {cover && (
          <img className='music-cover' src={cover} alt={info?.name} />
        )}
        <div className='music-info'>
          <div className='music-title'>{info?.name || '未知歌曲'}</div>
          <div className='music-artist'>{info?.artist || '未知歌手'}</div>
          <div className='music-meta'>
            {info?.album && <span className='meta-tag'>{info.album}</span>}
            <span className='meta-tag'>{formatDuration(info?.duration)}</span>
            <span className={`meta-tag ${wasDowngraded ? 'meta-warn' : ''}`}>
              {actualQuality || '未知'}
              {wasDowngraded && ' ↓'}
            </span>
            {fileSize > 0 && <span className='meta-tag'>{formatFileSize(fileSize)}</span>}
          </div>
        </div>
      </div>

      <div className='music-card-actions'>
        {lyrics && (
          <button
            className='btn-primary btn-sm'
            onClick={handleDownloadAll}
            disabled={downloading || !url}
          >
            {downloading ? '下载中...' : '全部下载'}
          </button>
        )}
        <button
          className='btn-secondary btn-sm'
          onClick={handleDownloadMusic}
          disabled={downloading || !url}
        >
          下载音乐
        </button>
        {lyrics && (
          <button className='btn-secondary btn-sm' onClick={handleDownloadLyrics}>
            下载歌词
          </button>
        )}
        <button className='btn-ghost btn-sm' onClick={() => setShowJson(!showJson)}>
          {showJson ? '收起 JSON' : '查看 JSON'}
        </button>
        {downloadMsg && (
          <span className={`download-msg ${downloadMsg.includes('失败') ? 'msg-error' : 'msg-success'}`}>
            {downloadMsg}
          </span>
        )}
      </div>

      {showJson && (
        <pre className='result-json'>
          {JSON.stringify(song, null, 2)}
        </pre>
      )}
    </div>
  )
}
