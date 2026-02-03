import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppProvider } from './context/AppContext'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'
import './index.css'
import { initSentry } from './lib/sentry'

initSentry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
