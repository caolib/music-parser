import { useState } from 'react'

export default function Settings ({ apiKey, downloadPath, onBack, onSave }) {
  const [key, setKey] = useState(apiKey)
  const [dlPath, setDlPath] = useState(downloadPath)

  const handleSelectFolder = () => {
    const paths = window.utools.showOpenDialog({
      title: '选择下载目录',
      defaultPath: dlPath,
      properties: ['openDirectory']
    })
    if (paths && paths[0]) {
      setDlPath(paths[0])
    }
  }

  const handleSave = () => {
    onSave({ apiKey: key, downloadPath: dlPath })
    onBack()
  }

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
            <h1>设置</h1>
          </div>
        </header>

        <div className='parse-card'>
          <div>
            <label className='form-label'>API Key</label>
            <input
              className='form-input'
              type='password'
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder='输入 th_ 开头的 API Key'
            />
            <p className='form-hint'>密钥将加密存储在本地</p>
          </div>

          <div>
            <label className='form-label'>下载位置</label>
            <div className='path-row'>
              <span className='path-display'>{dlPath}</span>
              <button className='btn-secondary' onClick={handleSelectFolder}>
                更改
              </button>
            </div>
          </div>

          <div className='action-row' style={{ justifyContent: 'flex-end' }}>
            <button className='btn-primary' onClick={handleSave}>
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
