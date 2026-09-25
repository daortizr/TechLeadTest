import React from 'react'
import { Link } from 'react-router-dom'
import './PlaceholderPage.css'

interface PlaceholderPageProps {
  title: string
  description: string
}

// Temporary screen for routes whose feature is still being built
export default function PlaceholderPage({ title, description }: PlaceholderPageProps): React.ReactElement {
  return (
    <section className="placeholder">
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/">Volver a la búsqueda</Link>
    </section>
  )
}
