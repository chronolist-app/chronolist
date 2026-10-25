import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import routesBasic from './routes/routeBasic.tsx'
import "bootstrap/dist/css/bootstrap.min.css"
import ApiNotice from '@/components/ApiNotice'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiNotice />
    <RouterProvider router={routesBasic} />
  </StrictMode>,
)
