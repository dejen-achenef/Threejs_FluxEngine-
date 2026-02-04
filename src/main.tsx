import React from 'react'
import ReactDOM from 'react-dom/client'
import { PCBViewer } from '../PCBViewer'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PCBViewer width={100} height={80} thickness={1.6} />
  </React.StrictMode>,
)
