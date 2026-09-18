export function PriceModeLegend() {
  return (
    <div className="rounded-xl border border-gold-400/30 bg-gradient-to-r from-wine-50 to-gold-50 px-4 py-3 text-sm text-espresso-800">
      <p>
        각 면세점 칸은 <span className="font-semibold text-wine-700">원래가</span>와{" "}
        <span className="font-semibold text-wine-700">성인인증가</span>입니다. 가격은
        달러와 원화(환율 환산)를 함께 보여 줍니다. 비교 목록은 관리자가 저장한 JSON
        파일을 불러옵니다. 생년월일 확인 후에만 볼 수 있으며, 회원 로그인은 하지
        않습니다.
      </p>
    </div>
  );
}
