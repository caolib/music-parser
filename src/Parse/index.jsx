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

function renderTemplate (value, context) {
  if (typeof value !== 'string') return value

  return value.replace(/\{\{([\s\S]*?)\}\}/g, (_, expression) => {
    const expr = expression.trim()
    if (!expr) return ''
    try {
      const evaluator = new Function('ctx', `with (ctx) { return (${expr}) }`)
      const result = evaluator(context)
      return result == null ? '' : String(result)
    } catch {
      const fallback = context[expr]
      return fallback == null ? '' : String(fallback)
    }
  })
}

function resolveConfigValue (value, context) {
  if (typeof value === 'string') return renderTemplate(value, context)
  if (Array.isArray(value)) return value.map(item => resolveConfigValue(item, context))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveConfigValue(v, context)])
    )
  }
  return value
}

function parseResponseData (rawText) {
  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

function normalizeCoverUrl (url) {
  if (!url || typeof url !== 'string') return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `https://img4.kuwo.cn${url}`
  return ''
}

function buildCoverMap (selectedPlatform, providerResponse) {
  const map = {}

  if (selectedPlatform === 'netease') {
    const songs = providerResponse?.result?.songs || []
    songs.forEach(item => {
      const id = String(item?.id || '')
      const cover = item?.album?.picUrl || ''
      if (id && cover) map[id] = cover
    })
  }

  if (selectedPlatform === 'qq') {
    const songs = providerResponse?.req?.data?.body?.song?.list || []
    songs.forEach(item => {
      const id = String(item?.mid || '')
      const albumMid = item?.album?.mid || ''
      if (id && albumMid) {
        map[id] = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`
      }
    })
  }

  if (selectedPlatform === 'kuwo') {
    const songs = providerResponse?.abslist || []
    songs.forEach(item => {
      const id = String((item?.MUSICRID || '').replace('MUSIC_', ''))
      const rawCover = item?.web_albumpic_short || item?.web_albumpic || item?.pic || ''
      const cover = normalizeCoverUrl(rawCover)
      if (id && cover) map[id] = cover
    })
  }

  return map
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
  const [searchResults, setSearchResults] = useState([])
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

  // 清空搜索结果当输入改变时
  useEffect(() => {
    if (searchResults.length > 0) setSearchResults([])
  }, [inputValue])

  const requestPreview = useMemo(() => {
    return resolveRequestPayload(inputValue, platform)
  }, [inputValue, platform])

  const handleSearch = async () => {
    setError('')
    setSongs([])
    setSearchResults([])

    if (!inputValue.trim()) {
      setError('请输入搜索关键词')
      return
    }

    setLoading(true)

    try {
      const methodRes = await fetch(`https://tunehub.sayqz.com/api/v1/methods/${platform}/search`)
      const methodData = await methodRes.json()

      if (methodData.code !== 0 || !methodData.data) {
        throw new Error(methodData.message || '不支持该平台的搜索功能')
      }

      const config = methodData.data
      const templateContext = {
        keyword: inputValue.trim(),
        page: 1,
        limit: 20,
        pageSize: 20
      }

      let requestUrl = config.url
      const resolvedParams = resolveConfigValue(config.params || {}, templateContext)
      const resolvedBody = resolveConfigValue(config.body || null, templateContext)

      if (config.method?.toUpperCase() === 'GET' && Object.keys(resolvedParams).length > 0) {
        const search = new URLSearchParams()
        Object.entries(resolvedParams).forEach(([key, value]) => {
          search.append(key, String(value))
        })
        const hasQuery = requestUrl.includes('?')
        requestUrl += `${hasQuery ? '&' : '?'}${search.toString()}`
      }

      const requestOptions = {
        method: config.method || 'GET',
        headers: { ...(config.headers || {}) }
      }

      if (config.method?.toUpperCase() !== 'GET' && resolvedBody) {
        requestOptions.body = resolvedBody
      }

      const proxyRes = await window.services.request(requestUrl, requestOptions)
      if (proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
        throw new Error(`搜索请求失败: ${proxyRes.statusCode}`)
      }

      const providerResponse = parseResponseData(proxyRes.data)
      let list = []

      if (config.transform) {
        const transformFn = new Function(`return (${config.transform})`)()
        list = transformFn(providerResponse)
      } else if (Array.isArray(providerResponse)) {
        list = providerResponse
      }

      if (!Array.isArray(list) || list.length === 0) {
        setSearchResults([])
        setError('未找到相关歌曲')
        return
      }

      const coverMap = buildCoverMap(platform, providerResponse)
      const normalizedList = list.map(item => ({
        ...item,
        cover: item?.cover || coverMap[String(item?.id || '')] || ''
      }))

      setSearchResults(normalizedList)
    } catch (err) {
      console.error(err)
      setError(err.message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }

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
        setError(`请求失败：${response.status}-${data?.message || ''}`)
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

  const handleDeleteRecord = (recordId) => {
    const updated = history.filter(r => r.id !== recordId)
    setHistory(updated)
    saveHistory(updated)
  }

  const openExternal = (url) => {
    if (window.utools) {
      window.utools.shellOpenExternal(url)
    } else {
      window.open(url, '_blank')
    }
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
        onDeleteRecord={handleDeleteRecord}
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
            <label className='form-label'>歌曲链接 / ID / 搜索词</label>
            <input
              type='text'
              className='form-input'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='输入歌名搜索，或粘贴分享链接/ID'
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
            <div className='action-buttons'>
              <button
                type='button'
                className='btn-secondary form-row-btn'
                onClick={handleSearch}
                disabled={loading}
                title='根据输入框内容搜索'
              >
                搜索
              </button>
              <button
                type='button'
                className='btn-primary form-row-btn'
                onClick={handleParse}
                disabled={loading}
              >
                {loading && <span className='spinner' />}
                {loading ? '处理中...' : '开始解析'}
              </button>
            </div>
          </div>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className='search-results-panel'>
               <div className='panel-header'>
                 <span className='panel-title'>搜索结果 ({searchResults.length})</span>
                 <button className='panel-close' onClick={() => setSearchResults([])}>×</button>
               </div>
               <div className='search-list'>
                 {searchResults.map((item, idx) => (
                   <div key={item.id || idx} className='search-item' onClick={() => setInputValue(item.id)}>
                     {item.cover && (
                       <img
                         className='search-cover'
                         src={item.cover}
                         alt={item.name || '封面'}
                         onError={(e) => { e.currentTarget.style.display = 'none' }}
                       />
                     )}
                     <div className='item-main'>
                       <div className='item-name'>{item.name}</div>
                       <div className='item-artist'>
                         {item.artist}
                         {item.album ? ` · ${item.album}` : ''}
                       </div>
                     </div>
                     <button className='btn-small' onClick={(e) => {
                       e.stopPropagation()
                       setInputValue(item.id)
                     }}>填入ID</button>
                   </div>
                 ))}
               </div>
            </div>
          )}

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

        {/* 结果展示-音乐卡片列表 */}
        {songs.length > 0 && (
          <div className='result-wrapper'>
            {songs.map((song, idx) => (
              <MusicCard
                key={song.id || idx}
                song={song}
                downloadPath={downloadPath}
                platform={requestPreview?.platform || platform}
              />
            ))}
          </div>
        )}

        <footer className='parse-footer'>
          <span>服务提供：<span className='link' onClick={() => openExternal('https://tunehub.sayqz.com')}>TuneHub</span></span>
          <span className='footer-sep'>·</span>
          <span><span className='link' onClick={() => openExternal('https://linux.do/t/topic/1509257/27')}>LinuxDo 主贴</span></span>
        </footer>
      </div>
    </div>
  )
}
