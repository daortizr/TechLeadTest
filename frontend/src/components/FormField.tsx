import React from 'react'
import './FormField.css'

interface BaseProps {
  id: string
  label: string
  error?: string | null
}

type TextFieldProps = BaseProps & React.InputHTMLAttributes<HTMLInputElement>

function describedBy(id: string, error?: string | null): string | undefined {
  return error ? `${id}-error` : undefined
}

function FieldError({ id, error }: { id: string; error?: string | null }): React.ReactElement | null {
  return error ? (
    <p id={`${id}-error`} className="form-field__error">
      {error}
    </p>
  ) : null
}

export function TextField({ id, label, error, ...inputProps }: TextFieldProps): React.ReactElement {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error)} {...inputProps} />
      <FieldError id={id} error={error} />
    </div>
  )
}

type SelectFieldProps = BaseProps &
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }

export function SelectField({ id, label, error, options, ...selectProps }: SelectFieldProps): React.ReactElement {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error)} {...selectProps}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={id} error={error} />
    </div>
  )
}
