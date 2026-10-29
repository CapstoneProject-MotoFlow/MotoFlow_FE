import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './shared/assets/styles/global.css'
import './modules/auth/auth.css'
import './shared/assets/styles/dashboard.css'
import './modules/admin/admin.css'
import App from './app/App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
