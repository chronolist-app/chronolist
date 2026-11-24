import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import routesBasic from './routes/routeBasic.tsx'
import "bootstrap/dist/css/bootstrap.min.css"
import ApiNotice from '@/components/ApiNotice'
import AppSnackbarProvider from '@/components/AppSnackbarProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiNotice />
    <AppSnackbarProvider>
      <RouterProvider router={routesBasic} />
    </AppSnackbarProvider>
  </StrictMode>,
)
