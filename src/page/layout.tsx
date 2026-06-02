import { Outlet } from "react-router";
import AppHeader from "../components/common/AppHeader";
import AppFooter from "../components/common/AppFooter";

// 전체 페이지의 공통 레이아웃
export default function RootLayout() {
  return (
    <div>
      <AppHeader /> {/* 모든 페이지 공통 헤더 */}
      <div>
        <Outlet /> {/* 현재 라우트 페이지가 렌더링 */}
      </div>
      <AppFooter /> {/* 모든 페이지 공통 푸터 */}
    </div>
  )
}