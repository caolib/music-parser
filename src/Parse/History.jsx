import { useState, useMemo } from 'react'
import MusicCard from './MusicCard.jsx'

export default function History ({ history, downloadPath, onBack, onClear, onDeleteRecord }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return history
    return history.filter(r =>
      (r.name || '').toLowerCase().includes(keyword) ||
      (r.artist || '').toLowerCase().includes(keyword)
    )
  }, [history, search])

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
            <h1>历史记录</h1>
            {history.length > 0 && (
              <button className='btn-ghost btn-sm header-action' onClick={onClear}>
                清空
              </button>
            )}
          </div>
        </header>

        {history.length > 0 && (
          <div className='history-search'>
            <input
              className='form-input'
              type='text'
              placeholder='搜索歌名或歌手...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className='empty-state'>
            <p>{search.trim() ? '没有匹配的记录' : '暂无解析记录'}</p>
          </div>
        ) : (
          <div className='history-list'>
            {filtered.map((record) => (
              <div key={record.id} className='history-card-wrapper'>
                {record.fullData ? (
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
