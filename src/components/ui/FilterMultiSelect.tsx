import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { IconChevronDown } from '../icons'
import './FilterMultiSelect.css'

export interface FilterMultiSelectOption<T extends string> {
  value: T
  label: string
}

interface FilterMultiSelectProps<T extends string> {
  allLabel: string
  unitPlural: string
  options: FilterMultiSelectOption<T>[]
  selected: T[]
  onChange: (next: T[]) => void
  'aria-label': string
}

export function FilterMultiSelect<T extends string>({
  allLabel,
  unitPlural,
  options,
  selected,
  onChange,
  'aria-label': ariaLabel,
}: FilterMultiSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const closedLabel = useMemo(() => {
    if (selected.length === 0) return allLabel
    if (selected.length === 1) {
      return (
        options.find((option) => option.value === selected[0])?.label ??
        allLabel
      )
    }
    return `${selected.length} ${unitPlural}`
  }, [allLabel, options, selected, unitPlural])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
      return
    }
    onChange([...selected, value])
  }

  return (
    <div className="filter-multi" ref={rootRef}>
      <button
        type="button"
        className="filter-multi-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="filter-multi-trigger-label">{closedLabel}</span>
        <IconChevronDown className="filter-multi-chevron" />
      </button>
      {open ? (
        <div
          id={listId}
          className="filter-multi-menu"
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const checked = selected.includes(option.value)
            return (
              <label
                key={option.value}
                className="filter-multi-option"
                role="option"
                aria-selected={checked}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
