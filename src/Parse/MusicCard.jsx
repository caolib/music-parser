import { useState, useEffect, useCallback } from 'react'

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

function getCoverExt (coverUrl) {
  if (!coverUrl) return 'jpg'
  try {
    const pathname = new URL(coverUrl).pathname
    const match = pathname.match(/\.(\w+)$/)
    if (match) {
      const ext = match[1].toLowerCase()
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) return ext
    }
  } catch { /* ignore */ }
  return 'jpg'
}

function formatTime (ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const platformLabelMap = {
  netease: '网易云',
  qq: 'QQ音乐',
  kuwo: '酷我'
}

function getSongUrl (platform, songId) {
  if (!platform || !songId) return ''
  switch (platform) {
    case 'netease': return `https://music.163.com/song?id=${songId}`
    case 'qq': return `https://y.qq.com/n/ryqq_v2/songDetail/${songId}`
    case 'kuwo': return `https://kuwo.cn/play_detail/${songId}`
    default: return ''
  }
}

export default function MusicCard ({ song, downloadPath, onDeleteRecord, platform, time }) {
  const [showJson, setShowJson] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState('')
  const [status, setStatus] = useState({ music: false, lyrics: false, cover: false })

  const { info, cover, lyrics, url, actualQuality, wasDowngraded, fileSize } = song

  const songUrl = getSongUrl(platform, song.id)

  // 计算各文件路径
  const baseName = info ? sanitizeFileName(`${info.artist}-${info.name}`) : ''
  const musicExt = getExtByQuality(actualQuality)
  const musicPath = baseName ? window.services.pathJoin(downloadPath, `${baseName}.${musicExt}`) : ''
  const lrcPath = baseName ? window.services.pathJoin(downloadPath, `${baseName}.lrc`) : ''
  const coverExt = getCoverExt(cover)
  const coverPath = baseName ? window.services.pathJoin(downloadPath, `${baseName}.${coverExt}`) : ''

  // 检测下载状态
  const checkStatus = useCallback(() => {
    if (!baseName) return
    setStatus({
      music: musicPath && window.services.fileExists(musicPath),
      lyrics: lrcPath && lyrics && window.services.fileExists(lrcPath),
      cover: coverPath && cover && window.services.fileExists(coverPath)
    })
  }, [baseName, musicPath, lrcPath, coverPath, lyrics, cover])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // 判断全部下载按钮是否应禁用（所有可用项都已下载）
  const allDownloaded = status.music
    && (!lyrics || status.lyrics)
    && (!cover || status.cover)

  const handleDownloadMusic = async () => {
    if (!url) return
    if (status.music) {
      window.utools.shellShowItemInFolder(musicPath)
      return
    }
    setDownloading(true)
    setDownloadMsg('')
    try {
      await window.services.downloadFile(url, musicPath)
      setDownloadMsg('下载完成')
      checkStatus()
      window.utools.shellShowItemInFolder(musicPath)
    } catch (err) {
      setDownloadMsg('下载失败: ' + (err?.message || '未知错误'))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadLyrics = () => {
    if (!lyrics) return
    if (status.lyrics) {
      window.utools.shellShowItemInFolder(lrcPath)
      return
    }
    try {
      window.services.writeTextToPath(lyrics, lrcPath)
      setDownloadMsg('歌词已保存')
      checkStatus()
      window.utools.shellShowItemInFolder(lrcPath)
    } catch (err) {
      setDownloadMsg('保存失败: ' + (err?.message || '未知错误'))
    }
  }

  const handleDownloadCover = async () => {
    if (!cover) return
    if (status.cover) {
      window.utools.shellShowItemInFolder(coverPath)
      return
    }
    setDownloading(true)
    setDownloadMsg('')
    try {
      await window.services.downloadFile(cover, coverPath)
      setDownloadMsg('封面已保存')
      checkStatus()
      window.utools.shellShowItemInFolder(coverPath)
    } catch (err) {
      setDownloadMsg('保存失败: ' + (err?.message || '未知错误'))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAll = async () => {
    if (!url) return
    setDownloading(true)
    setDownloadMsg('')
    try {
      const tasks = []

      // 缺歌曲则下载
      if (!status.music) {
        tasks.push('歌曲')
        await window.services.downloadFile(url, musicPath)
      }

      // 缺歌词则保存
      if (lyrics && !status.lyrics) {
        tasks.push('歌词')
        window.services.writeTextToPath(lyrics, lrcPath)
      }

      // 缺封面则下载
      if (cover && !status.cover) {
        tasks.push('封面')
        await window.services.downloadFile(cover, coverPath)
      }

      checkStatus()
      setDownloadMsg(tasks.length > 0 ? `已下载: ${tasks.join('、')}` : '全部已存在')
      window.utools.shellShowItemInFolder(musicPath)
    } catch (err) {
      setDownloadMsg('下载失败: ' + (err?.message || '未知错误'))
      checkStatus()
    } finally {
      setDownloading(false)
    }
  }

  const handleDeleteFiles = () => {
    const deleted = []
    if (status.music && musicPath) {
      window.services.deleteFile(musicPath)
      deleted.push('歌曲')
    }
    if (status.lyrics && lrcPath) {
      window.services.deleteFile(lrcPath)
      deleted.push('歌词')
    }
    if (status.cover && coverPath) {
      window.services.deleteFile(coverPath)
      deleted.push('封面')
    }
    checkStatus()
    setDownloadMsg(deleted.length > 0 ? `已删除: ${deleted.join('、')}` : '无文件可删除')
  }

  const hasAnyFile = status.music || status.lyrics || status.cover

  const titleContent = info?.name || '未知歌曲'

  return (
    <div className='music-card'>
      <div className='music-card-body'>
        {(time || platform) && (
          <div className='card-top-tags'>
            {platform && <span className='card-platform-tag'>{platformLabelMap[platform] || platform}</span>}
            {time && <span className='card-time-tag'>{formatTime(time)}</span>}
          </div>
        )}
        {cover && (
          <img className='music-cover' src={cover} alt={info?.name} />
        )}
        <div className='music-info'>
          {songUrl ? (
            <a
              className='music-title music-title-link'
              href={songUrl}
              onClick={(e) => { e.preventDefault(); window.utools.shellOpenExternal(songUrl) }}
            >
              {titleContent}
            </a>
          ) : (
            <div className='music-title'>{titleContent}</div>
          )}
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
          <div className='download-status'>
            <span className={`status-tag ${status.music ? 'status-done' : 'status-pending'}`}>
              {status.music ? '✓' : '○'} 歌曲
            </span>
            {lyrics && (
              <span className={`status-tag ${status.lyrics ? 'status-done' : 'status-pending'}`}>
                {status.lyrics ? '✓' : '○'} 歌词
              </span>
            )}
            {cover && (
              <span className={`status-tag ${status.cover ? 'status-done' : 'status-pending'}`}>
                {status.cover ? '✓' : '○'} 封面
              </span>
            )}
          </div>
        </div>
      </div>

      <div className='music-card-actions'>
        <button
          className='btn-primary btn-sm'
          onClick={handleDownloadAll}
          disabled={downloading || !url || allDownloaded}
        >
          {downloading ? '下载中...' : '全部下载'}
        </button>
        <button
          className={`btn-secondary btn-sm ${status.music ? 'btn-done' : ''}`}
          onClick={handleDownloadMusic}
          disabled={downloading || !url}
        >
          {status.music ? '打开音乐' : '下载音乐'}
        </button>
        {lyrics && (
          <button
            className={`btn-secondary btn-sm ${status.lyrics ? 'btn-done' : ''}`}
            onClick={handleDownloadLyrics}
            disabled={downloading}
          >
            {status.lyrics ? '打开歌词' : '下载歌词'}
          </button>
        )}
        {cover && (
          <button
            className={`btn-secondary btn-sm ${status.cover ? 'btn-done' : ''}`}
            onClick={handleDownloadCover}
            disabled={downloading}
          >
            {status.cover ? '打开封面' : '下载封面'}
          </button>
        )}
        <button className='btn-ghost btn-sm' onClick={() => setShowJson(!showJson)}>
          {showJson ? '收起 JSON' : '查看 JSON'}
        </button>
        {hasAnyFile && (
          <button className='btn-danger btn-sm' onClick={handleDeleteFiles} disabled={downloading}>
            删除文件
          </button>
        )}
        {onDeleteRecord && (
          <button className='btn-danger btn-sm' onClick={onDeleteRecord}>
            删除记录
          </button>
        )}
        {downloadMsg && (
          <span className={`download-msg ${downloadMsg.includes('失败') || downloadMsg.includes('删除') ? 'msg-error' : 'msg-success'}`}>
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
