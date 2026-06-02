import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/theme-provider.tsx"

import "./index.css"
import App from "./App.tsx"
import RootLayout from "../src/page/layout.tsx"
import SignUp from "./page/SignUpPage/index.tsx"
import SignIn from "./page/SignInPage/index.tsx"
import AiCalendar from "./page/AiChatPage/index.tsx"
import MyPage from "./page/MyPage/index.tsx"
import PlanDetail from "./page/PlanDetailPage/index.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<App />} />
            <Route path="/ai-calendar" element={<AiCalendar />} />
            <Route path="/ai-calendar/:chatId" element={<AiCalendar />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/plan-detail/:id" element={<PlanDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  </StrictMode>
)