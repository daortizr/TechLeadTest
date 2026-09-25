import React from 'react'
import './Button.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // primary: filled brand red. outline: white with a red border. neutral: white with a gray border (utility actions).
  variant?: 'primary' | 'outline' | 'neutral'
  fullWidth?: boolean
}

export default function Button({
  variant = 'primary',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps): React.ReactElement {
  const classes = ['btn', `btn--${variant}`, fullWidth ? 'btn--full' : '', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}
