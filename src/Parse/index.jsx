import { useEffect, useMemo, useState } from 'react'
import './index.css'
import MusicCard from './MusicCard.jsx'
import Settings from './Settings.jsx'
import History from './History.jsx'
import Dropdown from './Dropdown.jsx'

const BASE_URL = 'https://tunehub.sayqz.com/api/v1/parse'

// 平台配置
const platformList = [
  { value: 'netease', label: '网易云', icon: './netwase.svg' },
  { value: 'qq', label: 'QQ', icon: './QQ音乐.svg' },
  { value: 'kuwo', label: '酷我', icon: './酷我.svg' }
]

const platformLabelMap = Object.fromEntries(platformList.map(p => [p.value, p.label]))

const qualityOptions = [
  { value: '128k', label: '标准 MP3 (128kbps)' },
  { value: '320k', label: '高品质 MP3 (320kbps)' },
  { value: 'flac', label: '无损 FLAC' },
  { value: 'flac24bit', label: '无损 FLAC (24bit)' }
]
const HISTORY_KEY = 'parseHistory'
const DOWNLOAD_PATH_KEY = 'downloadPath'
const MAX_HISTORY = 100

function getPayloadText (enterAction) {
  if (!enterAction) return ''
  if (typeof enterAction.payload === 'string') return enterAction.payload
  return ''
}

function parseFromUrl (text) {
  const value = text.trim()
  const neteaseMatch = value.match(/music\.163\.com\/(?:#\/)?song\?id=(\d+)/i)
  if (neteaseMatch) return { platform: 'netease', ids: neteaseMatch[1] }
  const qqMatch = value.match(/y\.qq\.com\/n\/ryqq_v2\/songDetail\/([^/?#]+)/i)
  if (qqMatch) return { platform: 'qq', ids: qqMatch[1] }
  const kuwoMatch = value.match(/kuwo\.cn\/play_detail\/(\d+)/i)
  if (kuwoMatch) return { platform: 'kuwo', ids: kuwoMatch[1] }
  return null
}

function parseIds (text) {
  return text.split(/[\s,，]+/).map(item => item.trim()).filter(Boolean)
}

function resolveRequestPayload (inputValue, selectedPlatform) {
  const parsedByUrl = parseFromUrl(inputValue)
  if (parsedByUrl) return { ...parsedByUrl, isAutoPlatform: true }
  const idsList = parseIds(inputValue)
  if (!idsList.length) return null
  return { platform: selectedPlatform, ids: idsList.join(','), isAutoPlatform: false }
}

function loadApiKey () {
  try { return window.utools.dbCryptoStorage.getItem('apiKey') || '' } catch { return '' }
}

function saveApiKey (key) {
  try {
    if (key) window.utools.dbCryptoStorage.setItem('apiKey', key)
    else window.utools.dbCryptoStorage.removeItem('apiKey')
  } catch { /* ignore */ }
}

function loadDownloadPath () {
  try {
    return window.utools.dbStorage.getItem(DOWNLOAD_PATH_KEY) || window.services.getDownloadsPath()
  } catch {
    return ''
  }
}

function saveDownloadPath (p) {
  try { window.utools.dbStorage.setItem(DOWNLOAD_PATH_KEY, p) } catch { /* ignore */ }
}

function loadHistory () {
  try { return window.utools.dbStorage.getItem(HISTORY_KEY) || [] } catch { return [] }
}

function saveHistory (list) {
  try { window.utools.dbStorage.setItem(HISTORY_KEY, list) } catch { /* ignore */ }
}

export default function Parse ({ enterAction }) {
  const [view, setView] = useState('main') // main | settings | history
  const [inputValue, setInputValue] = useState('')
  const [apiKey, setApiKey] = useState(() => loadApiKey())
  const [downloadPath, setDownloadPath] = useState(() => loadDownloadPath())
  const [platform, setPlatform] = useState('netease')
  const [quality, setQuality] = useState('320k')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [songs, setSongs] = useState([])
  const [history, setHistory] = useState(() => loadHistory())

  useEffect(() => {
    // 仅当从超级面板传入文本时才填充，关键词触发不填充
    if (enterAction?.type === 'over') {
      const payloadText = getPayloadText(enterAction).trim()
      if (payloadText) setInputValue(payloadText)
    }
  }, [enterAction])

  // 根据链接自动切换平台
  useEffect(() => {
    const detected = parseFromUrl(inputValue)
    if (detected) setPlatform(detected.platform)
  }, [inputValue])

  const requestPreview = useMemo(() => {
    return resolveRequestPayload(inputValue, platform)
  }, [inputValue, platform])

  const handleParse = async () => {
    setError('')
    setSongs([])

    if (!apiKey.trim()) {
      setError('请先在设置中配置 API Key')
      return
    }

    const payload = resolveRequestPayload(inputValue, platform)
    if (!payload) {
      setError('请输入歌曲链接或歌曲 IDs')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey.trim()
        },
        body: JSON.stringify({
          platform: payload.platform,
          ids: payload.ids,
          quality
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(`请求失败：${response.status} - ${data?.message || ''}`)
        return
      }

      const songList = data?.data?.data || []
      setSongs(songList)

      // 将成功解析的歌曲加入历史记录
      const newRecords = songList
        .filter(s => s.success)
        .map(s => ({
          id: `${s.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          songId: s.id,
          name: s.info?.name || '未知',
          artist: s.info?.artist || '未知',
          platform: payload.platform,
          quality: s.actualQuality,
          time: Date.now(),
          fullData: s
        }))

      if (newRecords.length > 0) {
        const updated = [...newRecords, ...history].slice(0, MAX_HISTORY)
        setHistory(updated)
        saveHistory(updated)
      }
    } catch (err) {
      setError(err?.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = ({ apiKey: newKey, downloadPath: newPath }) => {
    setApiKey(newKey)
    saveApiKey(newKey)
    setDownloadPath(newPath)
    saveDownloadPath(newPath)
  }

  const handleClearHistory = () => {
    setHistory([])
    saveHistory([])
  }

  // 设置视图
  if (view === 'settings') {
    return (
      <Settings
        apiKey={apiKey}
        downloadPath={downloadPath}
        onBack={() => setView('main')}
        onSave={handleSaveSettings}
      />
    )
  }

  // 历史视图
  if (view === 'history') {
    return (
      <History
        history={history}
        downloadPath={downloadPath}
        onBack={() => setView('main')}
        onClear={handleClearHistory}
      />
    )
  }

  // 主视图
  return (
    <div className='parse-page'>
      <div className='parse-container'>

        <header className='parse-header'>
          <div className='header-row'>
            <div>
              <h1>歌曲解析</h1>
            </div>
            <div className='header-actions'>
              <button className='icon-btn' onClick={() => setView('history')} title='历史记录'>
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <circle cx='12' cy='12' r='10' />
                  <polyline points='12 6 12 12 16 14' />
                </svg>
              </button>
              <button className='icon-btn' onClick={() => setView('settings')} title='设置'>
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <circle cx='12' cy='12' r='3' />
                  <path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className='parse-card'>
          {/* 歌曲链接/ID 输入 */}
          <div>
            <label className='form-label'>歌曲链接或歌曲id</label>
            <textarea
              className='form-textarea'
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='粘贴分享链接或输入歌曲 ID'
            />
          </div>

          {/* 平台 + 音质 + 解析按钮 同一行 */}
          <div className='form-row'>
            <div>
              <label className='form-label'>平台</label>
              <div className='platform-group'>
                {platformList.map(p => (
                  <button
                    key={p.value}
                    type='button'
                    className={`platform-btn ${platform === p.value ? 'active' : ''}`}
                    onClick={() => setPlatform(p.value)}
                  >
                    <img className='platform-icon' src={p.icon} alt={p.label} />
                    <span>{p.label}</span>
                    {requestPreview?.isAutoPlatform && requestPreview.platform === p.value && (
                      <span className='auto-badge-inline'>自动识别</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className='quality-col'>
              <label className='form-label'>音质</label>
              <Dropdown
                options={qualityOptions}
                value={quality}
                onChange={setQuality}
              />
            </div>
            <button
              type='button'
              className='btn-primary form-row-btn'
              onClick={handleParse}
              disabled={loading}
            >
              {loading && <span className='spinner' />}
              {loading ? '解析中...' : '开始解析'}
            </button>
          </div>

          {/* 预览 + 错误信息 */}
          {(requestPreview || error) && (
            <div className='info-row'>
              {requestPreview && (
                <div className='preview-bar'>
                  <svg fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' />
                  </svg>
                  <div className='preview-content'>
                    <span>平台: <code>{platformLabelMap[requestPreview.platform] || requestPreview.platform}</code></span>
                    <span>ID: <code>{requestPreview.ids}</code></span>
                  </div>
                </div>
              )}
              {error && <span className='error-msg'>{error}</span>}
            </div>
          )}
        </div>

        {/* 结果展示 - 音乐卡片列表 */}
        {songs.length > 0 && (
          <div className='result-wrapper'>
            {songs.map((song, idx) => (
              <MusicCard
                key={song.id || idx}
                song={song}
                downloadPath={downloadPath}
              />
            ))}
          </div>
        )}

        <footer className='parse-footer'>
          <span>服务提供：<a href='https://tunehub.sayqz.com' target='_blank' rel='noopener noreferrer'>TuneHub</a></span>
          <span className='footer-sep'>·</span>
          <span><a href='https://linux.do/t/topic/1509257/27' target='_blank' rel='noopener noreferrer'>LinuxDo 主贴</a></span>
        </footer>
      </div>
    </div>
  )
}
