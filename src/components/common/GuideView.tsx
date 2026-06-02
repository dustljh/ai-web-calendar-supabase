
import { ArrowRight } from "lucide-react";

type GuideViewProps = {
  setGuideView: React.Dispatch<React.SetStateAction<boolean>>;
};

function GuideView({ setGuideView }: GuideViewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-black/20 bg-white p-6 shadow-2xl">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">가이드</h2>

          <button onClick={() => setGuideView(false)} className="text-gray-500 hover:text-black transition">
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 shrink-0" />
            <p>여행 지역과 기간을 입력하세요.</p>
          </div>

          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 shrink-0" />
            <p>원하는 테마도 함께 입력할 수 있습니다.</p>
          </div>

          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 shrink-0" />
            <p>예: 제주도 3박 4일 맛집 여행</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuideView