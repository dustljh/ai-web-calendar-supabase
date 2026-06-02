function AppFooter() {
  return (
    <footer className="w-full bg-gray-100 py-12 px-6 border-t border-gray-200 text-gray-600">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">

        {/* 팀 정보 섹션 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold text-gray-800">
            Team <span className="text-[#10B981]">Semicolon;</span>
          </h2>
          <p className="max-w-xs text-sm leading-relaxed">
            2026 캡스톤 디자인 - AI 기반 여행 일정 관리 서비스 프로젝트를 개발하고 있습니다.
          </p>
        </div>

        {/* 팀원 섹션 */}
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-gray-800 uppercase tracking-wider text-sm">Team Members</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span>이종호</span>
            <span>오도현</span>
            <span>전동욱</span>
            <span>허민준</span>
            <span>김승현</span>
          </div>
        </div>

        {/* 링크 섹션 */}
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-gray-800 uppercase tracking-wider text-sm">Links</h3>
          <div className="flex flex-col gap-1 text-sm">
            <a href="https://github.com/dustljh/ai-web-calendar-supabase" target="_blank" className="hover:text-[#059669] transition-colors">Github Repository</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
        <p>© 2026 Team Semicolon. All rights reserved.</p>
        <p>Computer Engineering @ Capstone Design 2026</p>
      </div>
    </footer>
  )
}

export default AppFooter