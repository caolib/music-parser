import MusicCard from './MusicCard.jsx'

function formatTime (ts) {
  const d = new Date(ts)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function History ({ history, downloadPath, onBack, onClear }) {
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

        {history.length === 0 ? (
          <div className='empty-state'>
            <p>暂无解析记录</p>
          </div>
        ) : (
          <div className='history-list'>
            {history.map((record) => (
              <div key={record.id} className='history-card-wrapper'>
                <div className='history-time-label'>{formatTime(record.time)}</div>
                {record.fullData ? (
                  <MusicCard song={record.fullData} downloadPath={downloadPath} />
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
