import { useState, useRef, useEffect } from 'react'

export default function Dropdown ({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = options.find(o => o.value === value) || options[0]

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
  }

  return (
    <div className={`dropdown ${disabled ? 'dropdown-disabled' : ''}`} ref={ref}>
      <button
        type='button'
        className='dropdown-trigger'
        onClick={() => !disabled && setOpen(!open)}
      >
        {selected.icon && <span className='dropdown-icon'>{selected.icon}</span>}
        <span className='dropdown-label'>{selected.label}</span>
        <svg className='dropdown-arrow' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='6 9 12 15 18 9' />
        </svg>
      </button>
      {open && (
        <ul className='dropdown-menu'>
          {options.map(opt => (
            <li
              key={opt.value}
              className={`dropdown-item ${opt.value === value ? 'active' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.icon && <span className='dropdown-icon'>{opt.icon}</span>}
              <span>{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
