import { useState, useMemo, useEffect, useCallback } from 'react'
import MusicCard from './MusicCard.jsx'
import LocalMusicCard from './LocalMusicCard.jsx'

export default function History ({ history, downloadPath, onBack, onClear, onDeleteRecord }) {
  const [activeTab, setActiveTab] = useState('history') // 'history' | 'local'
  const [localFiles, setLocalFiles] = useState([])
  const [search, setSearch] = useState('')

  const fetchLocalFiles = useCallback(() => {
    try {
      const files = window.services.listAudioFiles(downloadPath)
      setLocalFiles(files)
    } catch (e) {
      console.error('Fetch local files error', e)
    }
  }, [downloadPath])

  useEffect(() => {
    if (activeTab === 'local') {
      fetchLocalFiles()
    }
  }, [activeTab, fetchLocalFiles])

  // 每次进入页面重新获取一次（如果是 local tab）
  useEffect(() => {
    if (activeTab === 'local') {
      const timer = setInterval(fetchLocalFiles, 5000) // 简单的轮询，或者依赖手动刷新
      return () => clearInterval(timer)
    }
  }, [activeTab, fetchLocalFiles])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const source = activeTab === 'history' ? history : localFiles
    
    if (!keyword) return source
    
    return source.filter(r => 
      (r.name || '').toLowerCase().includes(keyword) || 
      (r.artist || '').toLowerCase().includes(keyword)
    )
  }, [history, localFiles, search, activeTab])

  return (
    <div className='parse-page'>
      <div className='parse-container'>
        <header className='parse-header'>
          <div className='header-row'>
            <button className='icon-btn' onClick={onBack} title='返回'>
              <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <polyline points='15 18 9 12 15 6' />
              </svg>
            </button>
            <h1>我的音乐</h1>
            {activeTab === 'history' && history.length > 0 && (
              <button className='btn-ghost btn-sm header-action' onClick={onClear}>
                清空记录
              </button>
            )}
            {activeTab === 'local' && (
              <button className='btn-ghost btn-sm header-action' onClick={fetchLocalFiles}>
                刷新
              </button>
            )}
          </div>
          
          <div className='tabs'>
            <button 
              className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              解析记录 ({history.length})
            </button>
            <button 
              className={`tab-item ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => setActiveTab('local')}
            >
              本地下载 ({localFiles.length})
            </button>
          </div>
        </header>

        <div className='history-search'>
          <input
            className='form-input'
            type='text'
            placeholder={activeTab === 'history' ? '搜索解析历史...' : '搜索本地文件...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className='empty-state'>
            <p>{search.trim() ? '没有匹配的记录' : (activeTab === 'history' ? '暂无解析记录' : '本地下载目录为空')}</p>
          </div>
        ) : (
          <div className='history-list'>
            {filtered.map((record) => (
              <div key={record.id} className='history-card-wrapper'>
                {activeTab === 'history' ? (
                  record.fullData ? (
                    <MusicCard
                      song={record.fullData}
                      downloadPath={downloadPath}
                      onDeleteRecord={() => onDeleteRecord(record.id)}
                      platform={record.platform}
                      time={record.time}
                    />
                  ) : (
                    <div className='music-card'>
                      <div className='music-card-body'>
                        <div className='music-info'>
                          <div className='music-title'>{record.name}</div>
                          <div className='music-artist'>{record.artist}</div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <LocalMusicCard 
                    file={record} 
                    onRefresh={fetchLocalFiles}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
